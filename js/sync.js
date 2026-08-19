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

  // 关键: syncPw 必须"按(用户 + App登录密码)确定性派生", 否则每台设备算出不同 token,
  // 永远登不上同一个云端账号 -> 跨设备同步彻底失效。用独立盐域(prefix 不同),
  // 保证该 token 与 App 登录密码"不相等", 即使 Supabase 泄露也无法反推 App 密码。
  function derivePw(u, appPassword) {
    const src = 'will-sync-v1|' + u + '|' + (appPassword || '');
    return Util.hash ? Util.hash(src) : ('fallback_' + src.length);
  }
  function getPw(u, appPassword) {
    if (appPassword) {
      // 登录/注册时拿到明文密码 -> 派生并持久化, 供后续刷新/重载复用
      const pw = derivePw(u, appPassword);
      try { localStorage.setItem(pwKey(u), pw); } catch (e) {}
      return pw;
    }
    // 重载/无明文密码时: 读本机已存的派生 token
    try { return localStorage.getItem(pwKey(u)) || ''; } catch (e) { return ''; }
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
    // 先试登录
    let r = await fetch(URL + '/auth/v1/token?grant_type=password&apikey=' + encodeURIComponent(KEY), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pw })
    });
    if (r.status === 429) { hitBackoff(); lastLoginStatus = 429; throw new Error('rate_limit'); }
    if (r.ok) {
      const j = await r.json();
      session = { access_token: j.access_token, refresh_token: j.refresh_token, user_id: j.user && j.user.id, expires_at: j.expires_at };
      saveSession(username, session);
      emailConfirmBlocked = false; blockedWarned = false; blockedReason = null;
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
    getPw(u, appPassword);
    try {
      // 先建立本机命名空间(meta.currentUser=u), 防止 importAll 后 save() 因 meta 为空而把云端拉回的数据丢弃
      Data.load(u);
      const remote = await pull(false);
      if (remote && remote.data) {
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
    if (!(await ensureSession())) return;
    let data;
    try { data = JSON.parse(Data.exportAll()); } catch (e) { return; }
    delete data.exportedAt;
    const now = new Date().toISOString();
    const headers = Object.assign({ 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, authHeaders());
    // 先 PATCH (更新已有行)
    let r = await fetch(URL + '/rest/v1/cfo_data?user_id=eq.' + encodeURIComponent(session.user_id), {
      method: 'PATCH', headers: headers, body: JSON.stringify({ data: data, updated_at: now })
    });
    if (r.status === 429) { hitBackoff(); throw new Error('rate_limit'); }
    if (r.status === 401) { try { await refresh(); } catch (e) {} return push(); }
    if (r.ok) {
      let arr = [];
      try { arr = await r.json(); } catch (e) {}
      if (Array.isArray(arr) && arr.length === 0) {
        // 没有行 -> 插入
        const ins = await fetch(URL + '/rest/v1/cfo_data?apikey=' + encodeURIComponent(KEY), {
          method: 'POST', headers: headers, body: JSON.stringify({ user_id: session.user_id, data: data, updated_at: now })
        });
        if (ins.ok) markPushed(username, Date.parse(now));
      } else {
        markPushed(username, Date.parse(now));
      }
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

  async function syncNow() {
    if (!enabled()) { setStatus('disabled'); return; }
    if (!username || syncing || rateLimited()) return;
    syncing = true;
    setStatus('syncing');
    try {
      const remote = await pull();
      if (remote) {
        const remoteTs = Date.parse(remote.updated_at) || 0;
        const localTs = getLastPush(username);
        if (remoteTs > localTs) {
          Data.importAll(JSON.stringify(remote.data || {}));
          markPushed(username, remoteTs);
          if (typeof Router !== 'undefined' && Router.handle) Router.handle();
          if (typeof Util !== 'undefined' && Util.toast) Util.toast(I18n.t('已从云端同步'), 'success');
        }
      }
      await push();
      if (emailConfirmBlocked) { setStatus('blocked'); maybeWarnBlocked(); return; }
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
    if (appPassword) getPw(u, appPassword); // 登录/注册时持久化派生 token
    session = loadSession(u);
    adoptCloudEmailVer(); // 收敛其它设备已 bump 的云端邮箱版本
    setStatus('idle');
    syncNow();
  }

  // App 密码修改后, 把云端账号密码同步成"新密码派生的 token", 否则下次登录会失败
  async function migratePassword(oldAppPw, newAppPw) {
    if (!enabled() || !username) return false;
    try {
      if (!(await ensureSession())) return false;
      const newToken = derivePw(username, newAppPw);
      const oldToken = derivePw(username, oldAppPw);
      const r = await fetch(URL + '/auth/v1/user?apikey=' + encodeURIComponent(KEY), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'apikey': KEY, 'Authorization': 'Bearer ' + session.access_token },
        body: JSON.stringify({ password: newToken })
      });
      if (r.ok) {
        try { localStorage.setItem(pwKey(username), newToken); } catch (e) {}
        return true;
      }
      console.warn('[Sync] migratePassword 失败', r.status);
      return false;
    } catch (e) { console.warn('[Sync] migratePassword error', e); return false; }
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
