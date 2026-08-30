/* =========================================================
   Sync — 跨设备云端同步 (Supabase)
   - 仅用 publishable key + 按用户隔离的 access_token
   - App 登录密码不上传; 用"用户名+密码"确定性派生的 syncPw 做鉴权
   - 策略: 登录即拉取远端; 本地改动防抖上传; 切回前台/每30s拉新
   - 冲突: updated_at 新者胜 (last-write-wins)
   - 状态机(status): disabled | idle | syncing | synced | offline, 供顶栏指示灯订阅
   ========================================================= */
const Sync = (() => {
  const CFG = window.SYNC_CONFIG || {};
  const URL = CFG.URL;
  const KEY = CFG.KEY;

  let username = null;
  let session = null;            // {access_token, refresh_token, user_id, expires_at}
  let pushTimer = null;
  let syncing = false;
  let backoffUntil = 0;          // 触发限流(429)后静默退避, 期间不重试
  let status = 'disabled';       // disabled | idle | syncing | synced | offline
  let lastPushOk = false;        // v2: 本会话最近一次上传是否成功(拉取覆盖保护的开关)
  let lastLoginStatus = null;    // 最近一次 ensureSession 的 HTTP 状态码, 供 loginRemote 区分失败原因
  let emailConfirmBlocked = false; // Supabase "Confirm email" 开启: 注册/登录返回无会话 或 账号存在但登录被拒
  let blockedReason = null;        // 'confirm_email_on'(确认开关仍开) | 'ghost_account'(账号创建时确认未关→未确认幽灵账号) | null
  let blockedWarned = false;       // 避免重复 toast 提示
  const statusCbs = [];

  function rateLimited() { return Date.now() < backoffUntil; }
  function hitBackoff() { backoffUntil = Date.now() + 30000; }
  function setStatus(s) { if (s === status) return; status = s; statusCbs.forEach(cb => { try { cb(s); } catch (e) {} }); }
  function getStatus() { return status; }
  function onStatus(cb) { if (typeof cb === 'function') statusCbs.push(cb); }

  function enabled() { return !!(URL && KEY); }

  // 本地持久化: 每用户独立存 syncPw 与会话, 不混入财务 cache
  function pwKey(u) { return 'cfo:' + u + ':supapw'; }
  function sessKey(u) { return 'cfo:' + u + ':supasess'; }
  function pushKey(u) { return 'cfo:' + u + ':lastpush'; }

  // ============ v2 修复: 云端身份与 App 登录密码【解耦】 ============
  // 旧版(v1): syncPw = hash('will-sync-v1|用户|App密码')。用户忘记密码重置后,
  // App 密码变了 -> 派生的云端 token 失配 -> 登不上原云端账号 -> 触发"幽灵账号
  // 自愈"换 +vN 邮箱重建空账号 -> 多设备云端账号分叉(两端不同步), 且空账号数据
  // 反噬覆盖本地(数据消失)。根因就是云端身份不该依赖 App 密码。
  // 新版(v2): syncPw 只由【用户名 + 固定盐】确定性派生, 改/重置 App 密码完全
  // 不影响云端登录。兼容旧 token: 登录云端失败时用本地遗留的 v1 token 重试,
  // 成功后把云端密码平滑升级为 v2 token, 老用户无感迁移。
  function derivePw(u) {
    const src = 'will-sync-v2|' + u;
    return Util.hash ? Util.hash(src) : ('fallback_' + src.length);
  }
  function legacyDerivePw(u, appPassword) {
    const src = 'will-sync-v1|' + u + '|' + (appPassword || '');
    return Util.hash ? Util.hash(src) : ('fallback_' + src.length);
  }
  function legacyKey(u) { return 'cfo:' + u + ':supapwlegacy'; }
  function getPw(u) {
    // v2: 云端 token 与 App 密码无关, 无需明文密码; 每次调用保证本机存的是 v2 token
    const pw = derivePw(u);
    try {
      const existing = localStorage.getItem(pwKey(u));
      if (existing && existing !== pw) {
        // 本机残留 v1 旧 token(掺过 App 密码) -> 挪到 legacy 槽, 供平滑迁移尝试
        try { localStorage.setItem(legacyKey(u), existing); } catch (e) {}
      }
      localStorage.setItem(pwKey(u), pw);
    } catch (e) {}
    return pw;
  }
  function getLegacyPw(u) {
    try { return localStorage.getItem(legacyKey(u)) || ''; } catch (e) { return ''; }
  }
  function loadSession(u) {
    try { return JSON.parse(localStorage.getItem(sessKey(u)) || 'null'); } catch (e) { return null; }
  }
  function saveSession(u, s) {
    try {
      if (s) localStorage.setItem(sessKey(u), JSON.stringify(s));
      else localStorage.removeItem(sessKey(u));
    } catch (e) {}
  }
  function getLastPush(u) {
    try { return parseInt(localStorage.getItem(pushKey(u)) || '0', 10) || 0; } catch (e) { return 0; }
  }
  function markPushed(u, ts) {
    try { localStorage.setItem(pushKey(u), String(ts)); } catch (e) {}
  }

  // 早期测试曾在 @will.app 命名空间留下一个用旧(随机)令牌创建的冲突账号,
  // 这里改用独立命名空间, 首次登录即重建干净云端身份并重新上传本机数据。
  // v49: 增加「云端邮箱版本号」机制 — 当用户在 Confirm email 开启时创建的旧账号
  // 变成"未确认幽灵账号"后, 关掉确认开关不会追溯修复。点"重新连接"时若仍被
  // 拦截(ghost_account), App 自动把云端邮箱换成 +v1/v2... 命名空间重建已确认账号,
  // 完全无需手工去 Supabase 删账号。版本号同时持久化到 localStorage 与 Data 用户
  // 对象(随 Data 同步), 实现多设备自动收敛到同一个新云端身份。
  function verKey(u) { return 'cfo:' + u + ':cloudver'; }
  function getCloudEmailVer(u) { try { return parseInt(localStorage.getItem(verKey(u)) || '0', 10) || 0; } catch (e) { return 0; } }
  function setCloudEmailVer(u, v) { try { localStorage.setItem(verKey(u), String(v)); } catch (e) {} }
  function emailOf(u) {
    const v = getCloudEmailVer(u);
    return u + (v > 0 ? ('+v' + v) : '') + '@sync.will.app';
  }
  function bumpCloudEmail() {
    if (!username) return;
    const v = getCloudEmailVer(username) + 1;
    setCloudEmailVer(username, v);
    // 镜像到 Data 用户对象, 让其它设备通过云端 Data 同步收敛到同一版本
    try {
      const d = Data.load(username);
      if (d.users[username]) { d.users[username].cloudEmailVer = v; Data.save(); }
    } catch (e) {}
    console.log('[Sync] cloud email bumped to ver=' + v);
  }
  // 跨设备收敛: 若云端 Data 拉回的用户记录带更高的 cloudEmailVer, 采用之
  function adoptCloudEmailVer() {
    if (!username) return;
    try {
      const d = Data.load(username);
      const remote = d.users[username] && d.users[username].cloudEmailVer;
      if (typeof remote === 'number' && remote > getCloudEmailVer(username)) {
        setCloudEmailVer(username, remote);
      }
    } catch (e) {}
  }

  function authHeaders() {
    const h = { 'apikey': KEY };
    if (session && session.access_token) h['Authorization'] = 'Bearer ' + session.access_token;
    return h;
  }

  async function refresh() {
    if (!session || !session.refresh_token) throw new Error('no refresh token');
    const url = URL + '/auth/v1/token?grant_type=refresh_token&apikey=' + encodeURIComponent(KEY);
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    if (!r.ok) throw new Error('refresh failed ' + r.status);
    const j = await r.json();
    session = {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      user_id: (j.user && j.user.id) || session.user_id,
      expires_at: j.expires_at
    };
    saveSession(username, session);
  }

  // 把云端账号密码升级为 v2 token(仅在用旧 token 登录成功后调用, 平滑迁移)
  async function updateCloudPassword(newToken) {
    if (!session || !session.access_token) return false;
    try {
      const r = await fetch(URL + '/auth/v1/user?apikey=' + encodeURIComponent(KEY), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'apikey': KEY, 'Authorization': 'Bearer ' + session.access_token },
        body: JSON.stringify({ password: newToken })
      });
      if (r.ok) {
        try { localStorage.setItem(pwKey(username), newToken); } catch (e) {}
        try { localStorage.removeItem(legacyKey(username)); } catch (e) {}
        return true;
      }
      console.warn('[Sync] updateCloudPassword 失败', r.status);
      return false;
    } catch (e) { console.warn('[Sync] updateCloudPassword error', e); return false; }
  }

  async function ensureSession(allowSignup) {
    lastLoginStatus = null;
    if (!enabled()) return false;
    // 仍有效
    if (session && session.expires_at && session.expires_at > Date.now() / 1000 + 60) return true;
    // 可刷新
    if (session && session.refresh_token) {
      try { await refresh(); emailConfirmBlocked = false; blockedWarned = false; blockedReason = null; return true; } catch (e) { session = null; }
    }
    const pw = getPw(username);
    if (!pw) { console.warn('[Sync] 缺少同步令牌, 跳过云端鉴权'); return false; }
    const email = emailOf(username);
    // 候选令牌: v2 优先, v1 遗留兜底(平滑迁移老账号)。逐个尝试登录
    const legacy = getLegacyPw(username);
    const candidates = (legacy && legacy !== pw) ? [pw, legacy] : [pw];
    let r = null, usedLegacy = false;
    for (const cand of candidates) {
      r = await fetch(URL + '/auth/v1/token?grant_type=password&apikey=' + encodeURIComponent(KEY), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: cand })
      });
      if (r.status === 429) { hitBackoff(); lastLoginStatus = 429; throw new Error('rate_limit'); }
      if (r.ok) { usedLegacy = (cand !== pw); break; }
    }
    if (r && r.ok) {
      const j = await r.json();
      session = { access_token: j.access_token, refresh_token: j.refresh_token, user_id: j.user && j.user.id, expires_at: j.expires_at };
      saveSession(username, session);
      emailConfirmBlocked = false; blockedWarned = false; blockedReason = null;
      // 用旧 token 登录成功 -> 云端密码平滑升级为 v2 token, 之后不再依赖 legacy
      if (usedLegacy) { try { await updateCloudPassword(pw); } catch (e) {} }
      return true;
    }
    const signInRejected = (r.status === 400 || r.status === 422);
    // 再试注册 (Confirm email 已关, 注册即激活) — 仅当允许(普通同步/上传); 跨设备登录检测时不允许
    if (allowSignup !== false && signInRejected) {
      const s = await fetch(URL + '/auth/v1/signup?apikey=' + encodeURIComponent(KEY), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: pw })
      });
      if (s.status === 429) { hitBackoff(); lastLoginStatus = 429; throw new Error('rate_limit'); }
      if (s.ok) {
        const j = await s.json();
        if (j.session && j.session.access_token) {
          // 正常: 注册即激活, 拿到会话
          session = { access_token: j.access_token, refresh_token: j.refresh_token, user_id: j.user && j.user.id, expires_at: j.expires_at };
          saveSession(username, session);
          emailConfirmBlocked = false; blockedWarned = false; blockedReason = null;
          return true;
        }
        // 注册返回 200 但无会话 -> Supabase "Confirm email" 开启, 账号未激活, 永远登不进/推不上
        emailConfirmBlocked = true;
        blockedReason = 'confirm_email_on';
        setStatus('blocked');
        lastLoginStatus = s.status;
        console.warn('[Sync] 注册成功但无会话: Supabase "Confirm email" 可能已开启');
        return false;
      }
      // 注册也失败(如 "User already registered"): 账号已存在但登录被拒 -> 多为"幽灵账号"(创建时 Confirm email 未关→未确认)
      if (s.status === 400 || s.status === 422) {
        emailConfirmBlocked = true;
        blockedReason = 'ghost_account';
        setStatus('blocked');
        lastLoginStatus = s.status;
        console.warn('[Sync] 账号已存在但登录被拒(多为创建时 Confirm email 未关导致的未确认幽灵账号):', r.status, s.status);
        return false;
      }
    }
    console.warn('[Sync] ensureSession failed', r.status);
    lastLoginStatus = r.status;
    return false;
  }

  async function pull(allowSignup) {
    if (!(await ensureSession(allowSignup))) return null;
    const url = URL + '/rest/v1/cfo_data?select=data,updated_at&user_id=eq.' + encodeURIComponent(session.user_id);
    const r = await fetch(url, { headers: authHeaders() });
    if (r.status === 429) { hitBackoff(); throw new Error('rate_limit'); }
    if (r.status === 401) { try { await refresh(); } catch (e) {} return pull(allowSignup); }
    if (!r.ok) return null;
    let arr = [];
    try { arr = await r.json(); } catch (e) {}
    if (Array.isArray(arr) && arr.length) return arr[0];
    return null;
  }

  // 跨设备登录: 本机无该账号时, 用"用户名+密码"确定性派生的令牌登录云端,
  // 拉回该账号的全部数据并导入本机, 使新手机也能登入并拿到历史数据。
  // 仅做"登录"(不自动注册), 用于检测云端是否已有该账号; 失败返回 { ok:false, reason }。
  // reason: 'disabled' | 'no_account'(云端无此行) | 'auth_failed'(账号存在但登录被拒, 多为 Confirm email 未关)
  //         | 'rate_limit'(限流) | 'network'(网络异常)
  async function loginRemote(u, appPassword) {
    if (!enabled()) return { ok: false, reason: 'disabled' };
    username = u;
    getPw(u);
    try {
      // 先建立本机命名空间(meta.currentUser=u), 防止 importAll 后 save() 因 meta 为空而把云端拉回的数据丢弃
      Data.load(u);
      const remote = await pull(false);
      // 判定"云端有此账号": 只要云端存在该行且 data 非空即可。
      // 注意: 不能要求 accounts 非空 —— 新注册的账号账本是空的(还没记账),
      // 但账号本身是存在的; 否则新账号跨设备登录会被误判为"云端不存在"。
      if (remote && remote.data && Object.keys(remote.data).length > 0) {
        Data.importAll(JSON.stringify(remote.data));
        // 兜底: 云端数据的 meta.currentUser 可能缺失, 强制绑定到本账号以保证本地可持久化;
        // 同时确保本地账号记录(密码哈希)存在, 使后续离线登录也能通过校验。
        const d = Data.load(u);
        if (!d.meta.currentUser) d.meta.currentUser = u;
        if (!d.users[u]) {
          d.users[u] = { username: u, password: Util.hash(appPassword), createdAt: Date.now() };
        }
        Data.save();
        markPushed(u, Date.parse(remote.updated_at) || Date.now());
        return { ok: true };
      }
      // pull 返回 null: 区分"云端无此账号"与"账号存在但登录被拒(Confirm email 未关)"
      let reason = 'no_account';
      if (lastLoginStatus === 429) reason = 'rate_limit';
      else if (lastLoginStatus === 400 || lastLoginStatus === 422) reason = 'auth_failed';
      return { ok: false, reason };
    } catch (e) {
      const reason = (e && /rate_limit/.test(String(e.message))) ? 'rate_limit' : 'network';
      if (reason === 'rate_limit') hitBackoff();
      console.warn('[Sync] loginRemote error', e);
      return { ok: false, reason };
    }
  }

  async function push() {
    if (!enabled() || !username) return;
    // v2 覆盖保护: 上传被阻断(无会话/鉴权失败)时, 必须标记失败, 禁止后续拉取覆盖本地
    if (!(await ensureSession())) { lastPushOk = false; return; }
    let data;
    try { data = JSON.parse(Data.exportAll()); } catch (e) { return; }
    delete data.exportedAt;
    const now = new Date().toISOString();
    const headers = Object.assign({ 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, authHeaders());
    // 先 PATCH (更新已有行)
    let r = await fetch(URL + '/rest/v1/cfo_data?user_id=eq.' + encodeURIComponent(session.user_id), {
      method: 'PATCH', headers: headers, body: JSON.stringify({ data: data, updated_at: now })
    });
    if (r.status === 429) { hitBackoff(); lastPushOk = false; throw new Error('rate_limit'); }
    if (r.status === 401) { try { await refresh(); } catch (e) { lastPushOk = false; } return push(); }
    if (r.ok) {
      let arr = [];
      try { arr = await r.json(); } catch (e) {}
      if (Array.isArray(arr) && arr.length === 0) {
        // 没有行 -> 插入
        const ins = await fetch(URL + '/rest/v1/cfo_data?apikey=' + encodeURIComponent(KEY), {
          method: 'POST', headers: headers, body: JSON.stringify({ user_id: session.user_id, data: data, updated_at: now })
        });
        if (ins.ok) { markPushed(username, Date.parse(now)); lastPushOk = true; }
        else { lastPushOk = false; console.warn('[Sync] 首次上传被拒(检查 RLS 策略/publishable key 权限)'); }
      } else {
        markPushed(username, Date.parse(now));
        lastPushOk = true;
      }
    } else {
      lastPushOk = false;
      console.warn('[Sync] push PATCH 失败', r.status);
    }
  }

  function schedulePush() {
    if (!enabled() || !username) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushTimer = null; push(); }, 800);
  }

  function maybeWarnBlocked() {
    if (blockedWarned) return;
    blockedWarned = true;
    if (typeof Util !== 'undefined' && Util.toast) {
      const msg = (blockedReason === 'ghost_account')
        ? I18n.t('云端账号未激活(创建时邮箱确认未关)。点顶栏同步指示灯可查看修复步骤')
        : I18n.t('云端同步被 Supabase Email Confirmation 拦截。点顶栏同步指示灯查看修复步骤');
      Util.toast(msg, 'warn');
    }
  }

  // 诊断: 当前被拦截的具体原因
  function getBlockedReason() { return blockedReason; }

  // 本地清空云端会话(保留派生令牌), 让下次 ensureSession 重新走 登录→注册 流程。
  // 用于"幽灵账号"场景: 用户在 Supabase 删除该账号后, 一键重建已确认的云端账号。
  function resetCloud() {
    session = null;
    emailConfirmBlocked = false;
    blockedReason = null;
    blockedWarned = false;
    if (username) { try { localStorage.removeItem(sessKey(username)); } catch (e) {} }
    setStatus('idle');
  }

  // 重新连接: 清会话后触发同步; 若仍撞到"幽灵账号"(原邮箱被旧未确认账号占着),
  // 自动 bump 云端邮箱到 +v1 命名空间重建, 全程无需用户手工操作 Supabase
  async function reconnect() {
    resetCloud();
    await syncNow();
    if (getStatus() === 'blocked' && blockedReason === 'ghost_account') {
      bumpCloudEmail();
      resetCloud();
      await syncNow();
    }
  }

  // ============ v2 覆盖保护 ============
  // 云端快照要覆盖本地前, 先把本地完整 JSON 备份到 cfo:<u>:backup(滚动保留最近 5 份),
  // 万一云端数据异常(空/旧/被别的设备覆盖), 用户仍可从备份恢复。
  function backupKey(u) { return 'cfo:' + u + ':backup'; }
  function backupLocal() {
    try {
      const key = backupKey(username);
      let arr = [];
      try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
      if (!Array.isArray(arr)) arr = [];
      arr.unshift({ t: Date.now(), data: Data.exportAll() });
      if (arr.length > 5) arr = arr.slice(0, 5);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) { console.warn('[Sync] backupLocal failed', e); }
  }
  // 本地是否有业务数据(账户/交易/存钱罐)。读不到时保守返回 true(禁止覆盖)。
  function localHasData() {
    try {
      return !!(Data.getAccounts && (Data.getAccounts().length || Data.getTransactions().length || Data.getPots().length));
    } catch (e) { return true; }
  }
  // 云端快照是否实质为空(没有账户也没有交易)
  function remoteEmpty(d) {
    d = d || {};
    return !(d.accounts && d.accounts.length) && !(d.transactions && d.transactions.length);
  }

  async function syncNow(opts) {
    opts = opts || {};
    if (!enabled()) { setStatus('disabled'); return; }
    if (!username || syncing || rateLimited()) return;
    syncing = true;
    setStatus('syncing');
    try {
      const remote = await pull();
      if (remote) {
        const remoteTs = Date.parse(remote.updated_at) || 0;
        const localTs = getLastPush(username);
        const remoteData = remote.data || {};
        // v2 覆盖保护: 只有当【本地上传成功过】或【本地本来就无数据】时才允许云端覆盖本地。
        // 否则(上传被阻断: 鉴权失败/幽灵账号/RLS 未配)一律以本地为准只推不拉,
        // 杜绝"记一笔收入 -> 30 秒后被云端旧快照抹掉"的回滚灾难。
        const canPull = (lastPushOk || !localHasData()) && !remoteEmpty(remoteData);
        if (remoteTs > localTs && canPull) {
          backupLocal();                        // 覆盖前先备份本地
          Data.importAll(JSON.stringify(remoteData));
          markPushed(username, remoteTs);
          if (typeof Router !== 'undefined' && Router.handle) Router.handle();
          if (typeof Util !== 'undefined' && Util.toast) Util.toast(I18n.t('已从云端同步'), 'success');
        }
      }
      await push();
      if (emailConfirmBlocked) {
        // 幽灵账号自愈: 普通登录 / 定时同步时若撞到"未确认幽灵账号"(创建时 Supabase
        // Confirm email 未关), 自动换 +vN 命名空间重建已确认云端账号, 无需用户手动点
        // "重新连接"。否则第二台设备(只做常规登录)会永远卡在旧幽灵邮箱上, 与已切到
        // +vN 的设备分处不同云端账号 -> 跨设备永远不同步。
        if (blockedReason === 'ghost_account' && !opts._bumped) {
          bumpCloudEmail();
          resetCloud();
          syncing = false;
          return syncNow({ _bumped: true });
        }
        setStatus('blocked'); maybeWarnBlocked(); return;
      }
      setStatus('synced');
    } catch (e) {
      if (e && /rate_limit/.test(String(e.message))) { hitBackoff(); setStatus('offline'); }
      else if (emailConfirmBlocked) { setStatus('blocked'); maybeWarnBlocked(); }
      else { console.warn('[Sync] syncNow error', e); setStatus('offline'); }
    } finally {
      syncing = false; // 不再在此强制 setStatus('synced'), 以免覆盖 blocked/offline
    }
  }

  function init(u, appPassword) {
    if (!enabled()) { setStatus('disabled'); return; }
    if (!u) return;
    if (username === u && session) { setStatus('idle'); return; } // 同一用户已初始化, 避免重复拉取/推送
    username = u;
    getPw(u); // v2: 云端 token 与 App 密码无关, 无需明文密码也能派生/持久化
    session = loadSession(u);
    adoptCloudEmailVer(); // 收敛其它设备已 bump 的云端邮箱版本
    setStatus('idle');
    syncNow();
  }

  // v2: 云端身份与 App 密码解耦, 修改/重置 App 密码【无需】迁移云端密码。
  // 保留此 API 仅为兼容旧调用方(settings.js 改密码后调用), 直接成功返回。
  async function migratePassword(oldAppPw, newAppPw) {
    return true;
  }

  function signOut() {
    if (username) saveSession(username, null);
    session = null;
    setStatus('disabled');
  }

  function isEmailConfirmBlocked() { return emailConfirmBlocked; }
  function getCloudEmail() { return username ? emailOf(username) : ''; }
  return { enabled: enabled, init: init, syncNow: syncNow, schedulePush: schedulePush, signOut: signOut, migratePassword: migratePassword, loginRemote: loginRemote, getStatus: getStatus, onStatus: onStatus, isEmailConfirmBlocked: isEmailConfirmBlocked, getBlockedReason: getBlockedReason, resetCloud: resetCloud, reconnect: reconnect, getCloudEmail: getCloudEmail };
})();
window.Sync = Sync;
