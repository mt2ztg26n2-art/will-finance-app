/* =========================================================
   App — 主入口: 登录/路由/全局事件
   ========================================================= */

(function () {
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  const loginError = document.getElementById('login-error');

  function showError(msg) {
    loginError.textContent = msg;
    loginError.classList.add('show');
    setTimeout(() => loginError.classList.remove('show'), 4000);
  }

  function showLogin() {
    loginScreen.classList.remove('hidden');
    app.classList.add('hidden');
  }

  function enterApp(username, password) {
    // 登录/注册成功时拿到明文密码 -> 连同密码一起初始化 Sync, 派生跨设备一致的云端令牌
    if (window.Sync) Sync.init(username, password);
    showApp();
  }

  // 顶栏云端同步控件: 手动"立即同步"按钮 + 状态指示灯(已同步/同步中/离线)
  let syncUIReady = false;
  function updateSyncUI(s) {
    const dot = document.getElementById('sync-dot');
    const txt = document.getElementById('sync-text');
    const btn = document.getElementById('sync-btn');
    if (!dot || !txt) return;
    const map = {
      syncing: ['syncing', I18n.t('同步中')],
      synced:  ['synced',  I18n.t('已同步')],
      offline:  ['offline', I18n.t('离线')],
      blocked:  ['blocked', I18n.t('同步被拦截')],
      idle:     ['synced',  I18n.t('已同步')],
      disabled: ['disabled', '']
    };
    const m = map[s] || map.idle;
    dot.className = 'sync-dot sync-dot-' + m[0];
    txt.textContent = m[1];
    const cloud = (window.Sync && Sync.getCloudEmail) ? Sync.getCloudEmail() : '';
    if (cloud && (s === 'synced' || s === 'syncing' || s === 'idle')) txt.textContent = m[1] + ' · ' + cloud;
    txt.style.display = (s === 'disabled') ? 'none' : '';
    if (btn) btn.title = (cloud ? (I18n.t('云端账号: ') + cloud + '\n') : '') + ((s === 'blocked')
      ? I18n.t('云端同步被拦截, 点此查看原因与修复')
      : (s === 'offline') ? I18n.t('云端连接失败,请检查网络') : I18n.t('立即同步'));
  }
  function setupSyncUI() {
    if (!syncUIReady) {
      syncUIReady = true;
      const btn = document.getElementById('sync-btn');
      const dotEl = document.getElementById('sync-dot');
      const onSyncClick = () => {
        if (window.Sync && Sync.getStatus() === 'blocked') openSyncBlockedModal();
        else if (window.Sync) Sync.syncNow();
      };
      if (btn) btn.addEventListener('click', onSyncClick);
      if (dotEl) dotEl.style.cursor = 'pointer', dotEl.addEventListener('click', onSyncClick);
      if (window.Sync && Sync.onStatus) Sync.onStatus(updateSyncUI);
      window.__refreshSyncUI = () => updateSyncUI(window.Sync ? Sync.getStatus() : 'disabled');
    }
    updateSyncUI(window.Sync ? Sync.getStatus() : 'disabled');
  }

  // 同步被拦截时的诊断弹窗: 精确说明原因(幽灵账号 / Confirm email 仍开)并引导自助恢复
  async function openSyncBlockedModal() {
    if (!window.Sync) return;
    const reason = Sync.getBlockedReason();
    const email = Sync.getCloudEmail();
    let bodyHtml;
    if (reason === 'ghost_account') {
      const userHtml = email ? email.replace('@sync.will.app', '') : '';
      bodyHtml = `
        <div class="sync-help">
          <p class="sh-lead"><b>${I18n.t('你的云端账号是"未确认幽灵账号"')}</b></p>
          <p>${I18n.t('你的云端账号(<b>%USER%</b>)是在 Supabase「Confirm email」开启时创建的, 关掉开关不会追溯确认它, 所以登不进去也传不上数据。本机数据完全不受影响。').replace('%USER%', userHtml)}</p>
          <p>${I18n.t('点下方"重新连接云端账号" — App 会自动换一个全新的云端邮箱命名空间(无需你去 Supabase 删账号), 重建一个已确认的云端账号, 然后立刻把你本机的数据上传过去, 跨设备同步即可恢复。')}</p>
          <p class="sh-note">${I18n.t('原理: 云端邮箱自动改成 username+v1@sync.will.app(原邮箱被旧幽灵账号占着), 多台设备会自动跟着切换到新邮箱; 旧邮箱下的云端数据会被自然放弃, 本机数据是源。')}</p>
          <p class="sh-note sh-cross">${I18n.t('跨设备排查: 两台设备顶栏显示的"云端账号"必须完全相同(含 +vN)。若不同, 说明两端用的用户名/密码不一致 — 请在两台设备都退出登录, 再用完全相同的用户名+密码重新登录, 即可汇入同一云端账号。')}</p>
        </div>`;
    } else {
      bodyHtml = `
        <div class="sync-help">
          <p class="sh-lead"><b>${I18n.t('Supabase「Confirm email」仍是开启状态')}</b></p>
          <p>${I18n.t('请到 Supabase 控制台 Authentication → Providers → Email 关闭「Confirm email」, 然后点"重新连接云端账号"。')}</p>
          <p class="sh-note">${I18n.t('关闭后, 新注册会自动确认, 同步即可恢复。')}</p>
          <p class="sh-note sh-cross">${I18n.t('跨设备排查: 两台设备顶栏显示的"云端账号"必须完全相同(含 +vN)。若不同, 说明两端用的用户名/密码不一致 — 请在两台设备都退出登录, 再用完全相同的用户名+密码重新登录, 即可汇入同一云端账号。')}</p>
        </div>`;
    }
    const ok = await Util.modal({
      title: I18n.t('同步被拦截 · 原因与修复'),
      size: 'large',
      body: bodyHtml,
      footer: `<button class="btn btn-ghost" data-act="cancel">${I18n.t('稍后')}</button><button class="btn btn-primary" data-act="confirm">${I18n.t('重新连接云端账号')}</button>`
    });
    if (ok) Sync.reconnect();
  }

  function showApp() {
    loginScreen.classList.add('hidden');
    app.classList.remove('hidden');
    setupSyncUI();
    const user = Auth.getCurrentUser();
    if (window.Sync) Sync.init(user); // 重载场景: 用本机已存的派生令牌初始化
    const name = user || 'User';
    document.getElementById('user-name').textContent = name;
    document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
    const settings = Data.getSettings();
    Router.handle();
    refreshShellSummary();
    I18n.applyStatic();
    syncLangBtns();
    updateBadges();
    startClock();
    // 登录后执行自动攒钱计划 (每日/每周/每月自动扣款), 完成即重渲染
    try { Data.runRules(); refreshShellSummary(); } catch (e) { console.warn('runRules', e); }
    // 登录后弹出文人墨客励志文案（独立页面, 右上角✕与取消/进入）
    try { Util.literatiWelcome(); } catch (e) { console.warn('literatiWelcome', e); }
  }

  function refreshShellSummary() {
    const elA = document.getElementById('ts-assets');
    const elN = document.getElementById('ts-net');
    if (!elA || !elN) return;
    const t = Data.totals();
    elA.textContent = Util.fmtMoney(t.totalAssets);
    elN.textContent = Util.fmtMoney(t.netAssets);
  }
  window.refreshShellSummary = refreshShellSummary;

  // 语言切换(横向分段控件: 登录页 / 顶栏 / 设置页) — 同步高亮态
  function syncLangBtns() {
    const cur = I18n.getLang();
    document.querySelectorAll('.lang-btn[data-lang]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-lang') === cur);
    });
  }
  window.__syncLangBtns = syncLangBtns;

  // 语言分段控件 — 全局事件委托(横向, 无下拉)
  document.addEventListener('click', (e) => {
    const segBtn = e.target.closest('.lang-btn[data-lang]');
    if (segBtn) {
      e.preventDefault();
      const lang = segBtn.getAttribute('data-lang');
      if (lang && lang !== I18n.getLang()) I18n.setLang(lang);
      return;
    }
  });
  // 初始化一次(页面加载时登录页也要显示正确的当前语言)
  try { syncLangBtns(); } catch (e) {}

  function updateBadges() {
    if (window.NotificationsView) NotificationsView.updateBadge();
    if (window.LiabilitiesView) LiabilitiesView.updateBadges();
  }

  function startClock() {
    const el = document.getElementById('footer-time');
    if (!el) return;
    setInterval(() => {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      el.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }, 1000);
  }

  document.querySelectorAll('.login-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const t = tab.dataset.tab;
      document.getElementById('login-form').classList.toggle('active', t === 'login');
      document.getElementById('register-form').classList.toggle('active', t === 'register');
    });
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const res = Auth.login(username, password);
    if (!res.ok) {
      // 本机无账号 -> 尝试用同一账号密码从云端拉取(跨设备登录), 让新手机也能登入并拿到历史数据
      if (res.code === 'no_account' && window.Sync && Sync.enabled()) {
        const btn = e.submitter || document.querySelector('#login-form button[type="submit"]');
        if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = I18n.t('正在从云端同步…'); }
        try {
          const r2 = await Sync.loginRemote(username, password);
          if (r2.ok) {
            localStorage.setItem('cfo:session', JSON.stringify({ username, remember: true }));
            Util.toast(I18n.t('已从云端同步, 欢迎回来'), 'success');
            enterApp(username, password);
            return;
          }
          // 拉取失败: 给出明确原因
          let msg = I18n.t('该账号在云端不存在, 请先在原设备登录并同步一次');
          if (r2.reason === 'rate_limit') msg = I18n.t('云端同步暂时受限, 请稍后重试');
          else if (r2.reason === 'auth_failed') {
            // 云端账号不可用(常见: 旧"未确认幽灵账号"占着邮箱)。不再静默建本地账号 —
            // 那是 v43 的兜底, 也是"什么密码都能登"的来源。现在改为显式提示 + 引导
            // 用户点击顶栏同步指示灯的"重新连接云端账号", App 会自动绕过幽灵账号。
            msg = I18n.t('云端账号不可用, 请点顶栏同步指示灯 → 重新连接云端账号(App 会自动修复, 无需手工操作)');
            showError(msg);
            // 同时把云端状态设为 blocked, 顶栏指示灯变橙可点
            try { if (window.Sync) { Sync.reconnect && Sync.reconnect(); } } catch (e) {}
            return;
          }
          else if (r2.reason === 'disabled') msg = I18n.t('未配置云端同步, 无法跨设备登录');
          else if (r2.reason === 'network') msg = I18n.t('网络异常, 无法连接云端');
          showError(msg);
          return;
        } catch (err) {
          console.warn('[login] loginRemote failed', err);
          showError(I18n.t('云端同步失败, 请稍后重试'));
          return;
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || I18n.t('登录'); }
        }
      }
      showError(res.error);
      return;
    }
    if (res.isNew) Util.toast('欢迎 · Welcome! 账户已创建', 'success');
    else Util.toast('欢迎回来 · Welcome back', 'success');
    enterApp(username, password);
  });

  document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-password-confirm').value;
    const secQ = document.getElementById('reg-security-q');
    const secA = document.getElementById('reg-security-a');
    const security = (secQ && secA && secA.value.trim())
      ? { q: secQ.value, a: secA.value.trim() }
      : null;
    const res = Auth.register(username, password, confirm, security);
    if (!res.ok) { showError(res.error); return; }
    Util.toast('欢迎 · Welcome! 账户已创建', 'success');
    enterApp(username, password);
  });

  // 忘记密码 → 多步弹窗(账号 → 密保验证 → 重设)
  const forgotLink = document.getElementById('forgot-link');
  if (forgotLink) forgotLink.addEventListener('click', (e) => { e.preventDefault(); openForgotPassword(); });

  // ===== 登录页辅助: 导入数据备份 / 同步说明 =====
  // 备份是「当前账号命名空间」的 JSON, 导入后写入本设备 localStorage, 再用原账号密码登录。
  function parseBackupUsername(text) {
    try {
      const obj = JSON.parse(text);
      return (obj.meta && obj.meta.currentUser) || (obj.users && Object.keys(obj.users)[0]) || '';
    } catch { return ''; }
  }
  function importBackupFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result || '');
          Data.importAll(text);
          resolve(parseBackupUsername(text));
        } catch (err) { console.error('[import] failed', err); reject(err); }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  const loginImportFile = document.getElementById('login-import-file');
  const loginImportBtn = document.getElementById('login-import-btn');
  if (loginImportBtn && loginImportFile) {
    loginImportBtn.addEventListener('click', () => loginImportFile.click());
    loginImportFile.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      loginImportFile.value = '';
      if (!file) return;
      try {
        const uname = await importBackupFile(file);
        if (uname) document.getElementById('login-username').value = uname;
        Util.toast(I18n.t('备份已导入, 请输入密码登录'), 'success');
      } catch {
        Util.toast(I18n.t('备份文件无法解析, 请确认是本站导出的 JSON'), 'error');
      }
    });
  }

  const loginSyncInfoBtn = document.getElementById('login-sync-info-btn');
  if (loginSyncInfoBtn) loginSyncInfoBtn.addEventListener('click', () => showSyncHelp());

  function showSyncHelp() {
    const cloudOn = window.Sync && Sync.enabled();
    Util.modal({
      title: I18n.t('数据怎么跨设备同步?'),
      size: 'large',
      body: `
        <div class="sync-help">
          <p class="sh-lead">${I18n.t('本应用默认把数据保存在当前设备的浏览器里。换手机、换浏览器或用无痕模式, 都看不到旧数据——这是隐私设计, 不是丢数据。')}</p>
          <div class="sh-steps">
            <div class="sh-step"><span class="sh-num">1</span><div><b>${I18n.t('在原设备导出备份')}</b><br/><span>${I18n.t('登录后到「设置 → 数据备份」导出一份 JSON, 或用本页「导入数据备份」。')}</span></div></div>
            <div class="sh-step"><span class="sh-num">2</span><div><b>${I18n.t('在新设备导入备份')}</b><br/><span>${I18n.t('在新手机/浏览器打开本页, 点「导入数据备份」选刚才的 JSON 即可恢复账号与全部记录。')}</span></div></div>
            <div class="sh-step"><span class="sh-num">3</span><div><b>${I18n.t('或用云端自动同步')}</b><br/><span>${cloudOn ? I18n.t('已检测到云端同步配置, 登录时会自动从云端拉取历史数据。') : I18n.t('在「设置」中配置 Supabase 云端同步后, 登录即自动跨设备同步。')}</span></div></div>
          </div>
          ${cloudOn ? '' : `<p class="sh-note">${I18n.t('提示: 若提示 Confirm email / 账号不存在, 多为云端未关闭 Email Confirmation, 需在 Supabase 控制台关闭后再试。')}</p>`}
        </div>`,
      footer: `<button class="btn btn-primary" data-act="close">${I18n.t('知道了')}</button>`
    });
  }

  function openForgotPassword() {
    const root = document.getElementById('modal-root');
    if (!root) return;
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal" style="max-width:430px;">
        <div class="modal-header">
          <div class="modal-title">${I18n.t('找回密码')}</div>
          <button class="modal-close" data-act="close">${Util.icon('x')}</button>
        </div>
        <div class="modal-body" id="fp-body"></div>
        <div class="modal-footer" id="fp-footer"></div>
      </div>`;
    root.appendChild(mask);
    const body = () => mask.querySelector('#fp-body');
    const footer = () => mask.querySelector('#fp-footer');
    const close = () => mask.remove();

    function step1() {
      body().innerHTML = `
        <div class="fp-field">
          <label>${I18n.t('账号')}</label>
          <input type="text" id="fp-user" class="input" placeholder="${I18n.t('请输入用户名')}" />
        </div>
        <p class="fp-hint">${I18n.t('输入注册时的账号,通过密保问题验证后重设密码。')}</p>`;
      footer().innerHTML = `
        <button class="btn btn-ghost" data-act="close">${I18n.t('取消')}</button>
        <button class="btn btn-primary" id="fp-next1">${I18n.t('下一步')}</button>`;
      footer().querySelector('#fp-next1').onclick = () => {
        const uname = body().querySelector('#fp-user').value.trim();
        if (!uname) { Util.toast(I18n.t('请输入用户名'), 'error'); return; }
        const data = Data.load(uname);
        const u = data.users[uname];
        if (!u) {
          // 本设备没有该账号: 多为换手机/换浏览器导致。不再笼统报"账号不存在",
          // 而是引导导入备份, 让账号与数据落到当前设备后可继续找回密码。
          body().innerHTML = `
            <div class="fp-warn">${I18n.t('本设备(这台手机/浏览器)上没有该账号的本地记录。每个设备独立保存数据, 换设备或换浏览器需重新导入备份。')}</div>
            <div class="fp-import-row">
              <button class="btn btn-primary" id="fp-import" type="button">${I18n.t('导入数据备份')}</button>
              <input type="file" id="fp-import-file" accept="application/json,.json" hidden />
            </div>
            <p class="fp-hint">${I18n.t('导入后该账号与全部记录会出现在本设备, 然后可继续找回密码。')}</p>`;
          footer().innerHTML = `
            <button class="btn btn-ghost" id="fp-go-register" type="button">${I18n.t('去注册')}</button>
            <button class="btn btn-ghost" data-act="close" type="button">${I18n.t('取消')}</button>`;
          const fpImport = body().querySelector('#fp-import');
          const fpFile = body().querySelector('#fp-import-file');
          fpImport.onclick = () => fpFile.click();
          fpFile.onchange = async (ev) => {
            const f = ev.target.files && ev.target.files[0];
            if (!f) return;
            try {
              await importBackupFile(f);
              Util.toast(I18n.t('备份已导入, 正在继续'), 'success');
              step1();
            } catch {
              Util.toast(I18n.t('备份文件无法解析, 请确认是本站导出的 JSON'), 'error');
            }
          };
          footer().querySelector('#fp-go-register').onclick = () => {
            close();
            const regTab = document.querySelector('.login-tab[data-tab="register"]');
            if (regTab) regTab.click();
          };
          return;
        }
        if (u.isDemo) { Util.toast(I18n.t('演示账号无需找回, 默认密码 demo123'), 'info'); close(); return; }
        if (!u.securityQ) {
          body().innerHTML = `<div class="fp-warn">${I18n.t('该账号注册时未设置密保问题,无法在线找回。可重新注册新账号,或使用演示账号 demo 体验。')}</div>`;
          footer().innerHTML = `<button class="btn btn-primary" data-act="close">${I18n.t('知道了')}</button>`;
          return;
        }
        step2(u, uname);
      };
    }
    function step2(u, uname) {
      body().innerHTML = `
        <div class="fp-q">${I18n.t('密保问题')}: <b>${Util.escapeHtml(u.securityQ)}</b></div>
        <div class="fp-field">
          <label>${I18n.t('密保答案')}</label>
          <input type="text" id="fp-ans" class="input" placeholder="${I18n.t('请输入密保答案')}" autocomplete="off" />
        </div>`;
      footer().innerHTML = `
        <button class="btn btn-ghost" id="fp-back">${I18n.t('上一步')}</button>
        <button class="btn btn-primary" id="fp-next2">${I18n.t('验证')}</button>`;
      footer().querySelector('#fp-back').onclick = step1;
      footer().querySelector('#fp-next2').onclick = () => {
        const ans = (body().querySelector('#fp-ans').value || '').trim().toLowerCase();
        if (Util.hash(ans) !== u.securityA) { Util.toast(I18n.t('密保答案错误'), 'error'); return; }
        step3(u, uname);
      };
    }
    function step3(u, uname) {
      body().innerHTML = `
        <div class="fp-field">
          <label>${I18n.t('新密码')}</label>
          <input type="password" id="fp-pw" class="input" placeholder="${I18n.t('至少 6 位')}" autocomplete="new-password" />
        </div>
        <div class="fp-field">
          <label>${I18n.t('确认新密码')}</label>
          <input type="password" id="fp-pw2" class="input" placeholder="${I18n.t('再次输入新密码')}" autocomplete="new-password" />
        </div>`;
      footer().innerHTML = `
        <button class="btn btn-ghost" id="fp-back">${I18n.t('上一步')}</button>
        <button class="btn btn-primary" id="fp-done">${I18n.t('重设密码')}</button>`;
      footer().querySelector('#fp-back').onclick = () => step2(u, uname);
      footer().querySelector('#fp-done').onclick = () => {
        const pw = body().querySelector('#fp-pw').value;
        const pw2 = body().querySelector('#fp-pw2').value;
        if (!pw || pw.length < 6) { Util.toast(I18n.t('新密码至少 6 位'), 'error'); return; }
        if (pw !== pw2) { Util.toast(I18n.t('两次新密码不一致'), 'error'); return; }
        const res = Auth.resetPassword(uname, pw);
        if (!res.ok) { Util.toast(res.error, 'error'); return; }
        Util.toast(I18n.t('密码已重置, 请用新密码登录'), 'success');
        close();
      };
    }
    mask.addEventListener('click', (e) => {
      if (e.target === mask) close();
      const t = e.target.closest('[data-act]');
      if (t && t.dataset.act === 'close') close();
    });
    step1();
  }

    document.getElementById('logout-btn').addEventListener('click', async () => {
    const ok = await Util.confirm(I18n.t('退出登录'), I18n.t('确定要退出当前账户吗?'), { okText: I18n.t('是'), cancelText: I18n.t('否') });
    if (ok) { if (window.Sync) Sync.signOut(); Auth.logout(); location.reload(); }
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => Router.navigate(item.dataset.route));
  });
  // 导航分组可折叠（带子级）
  document.querySelectorAll('.nav-group-head').forEach(head => {
    head.addEventListener('click', () => {
      const g = head.closest('.nav-group');
      if (g) g.classList.toggle('collapsed');
    });
  });

  document.getElementById('quick-add-btn').addEventListener('click', () => Router.navigate('quickInput'));
  document.getElementById('notif-bell').addEventListener('click', () => Router.navigate('notifications'));
  document.querySelector('.sidebar-toggle').addEventListener('click', () => {
    app.dataset.collapsed = app.dataset.collapsed !== 'true';
  });

  document.getElementById('global-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) { Router.navigate('transactions'); setTimeout(() => { const s = document.getElementById('tx-search'); if (s) { s.value = q; s.dispatchEvent(new Event('input')); } }, 200); }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'n' || e.key === 'N') {
      const tag = document.activeElement.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      e.preventDefault();
      Router.navigate('quickInput');
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('global-search').focus();
    }
  });

  window.__nav = (route) => Router.navigate(route);

  Router.register('dashboard', DashboardView.render);
  Router.register('quickInput', QuickInputView.render);
  Router.register('transactions', TransactionsView.render);
  Router.register('accounts', AccountsView.render);
  Router.register('budgets', BudgetsView.render);
  Router.register('monthlyReport', MonthlyReportView.render);
  Router.register('education', EducationView.render);
  Router.register('entrepreneurship', EntrepreneurshipView.render);
  Router.register('liabilities', LiabilitiesView.render);
  Router.register('pots', PotsView.render);
  Router.register('flow', FlowView.render);
  Router.register('datacenter', DataCenterView.render);
  Router.register('regionHeatmap', RegionHeatmapView.render);
  Router.register('notifications', NotificationsView.render);
  Router.register('settings', SettingsView.render);
  Router.register('yearlyReport', YearlyReportView.render);
  Router.register('audit', AuditView.render);

  Router.beforeEach((name) => {
    // 已登录才能访问
    if (!Auth.getCurrentUser()) { showLogin(); return false; }
    return true;
  });

  // 任一数据变更 (记账/改余额/导入) 触发: 顶栏总资产/净资产实时刷新,
  // 当前视图就地重渲染, 保证"银行卡余额一变, 所有数据都对应同步"。
  Data.on('change', () => {
    refreshShellSummary();
    updateBadges();
    if (window.Sync) Sync.schedulePush();
    const name = Router.getCurrent();
    if (name && name !== 'quickInput') {
      Router.handle();
    }
  });

  // 跨设备同步: 切回前台 / 每30秒自动拉取云端最新账本
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && window.Sync) Sync.syncNow();
  });
  setInterval(() => { if (window.Sync) Sync.syncNow(); }, 30000);

  Router.init();
  I18n.applyStatic();

  // 安装到手机横幅: Android 触发 beforeinstallprompt; iOS 给出"添加到主屏幕"引导
  setupInstallBanner();

  const existing = Auth.init();
  if (existing) {
    showApp();
  } else {
    showLogin();
  }

  // 跨设备安装: 捕获 beforeinstallprompt, 提供「立即安装」或平台引导
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
  });

  function installApp() {
    if (deferredInstall) {
      try { deferredInstall.prompt(); } catch (e) {}
      const d = deferredInstall;
      deferredInstall = null;
      try { if (d.userChoice && d.userChoice.then) d.userChoice.then(() => {}); } catch (e) {}
      return;
    }
    openInstallGuide();
  }
  window.__installApp = installApp;

  function openInstallGuide() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/.test(ua);
    const platform = isIOS ? 'ios' : (isAndroid ? 'android' : 'desktop');
    const steps = {
      ios: [
        I18n.t('在 Safari 浏览器中打开本页面 (请用 Safari, 不要用微信内置浏览器)。'),
        I18n.t('点击底部工具栏中间的「分享」按钮 (方框+向上箭头)。'),
        I18n.t('向下滑动找到「添加到主屏幕」, 点击后再点「添加」即可。'),
      ],
      android: [
        I18n.t('在 Chrome 浏览器中打开本页面。'),
        I18n.t('点击右上角 ⋯ 菜单, 选择「安装应用」(Install App)。'),
        I18n.t('在弹出提示中点「安装」, 应用将出现在主屏幕。'),
      ],
      desktop: [
        I18n.t('在桌面 Chrome / Edge 打开本页面。'),
        I18n.t('点击地址栏右侧的「安装」图标, 或浏览器菜单 → 安装。'),
        I18n.t('按提示安装, 即可从桌面像 App 一样启动。'),
      ],
    };
    const arr = steps[platform] || steps.desktop;
    const list = arr.map((s, i) => `<div class="ig-step"><span class="ig-step-num">${i + 1}</span><div class="ig-step-body">${s}</div></div>`).join('');
    const badge = platform === 'ios' ? I18n.t('iOS (Safari)') : (platform === 'android' ? I18n.t('Android (Chrome)') : I18n.t('桌面浏览器'));
    const cta = deferredInstall
      ? `<button class="btn btn-primary" id="ig-install-now">${I18n.t('立即安装')}</button>`
      : '';
    const body = document.createElement('div');
    body.innerHTML = `
      <span class="ig-badge">${badge}</span>
      <p class="fp-hint" style="margin-top:0">${I18n.t('本应用可安装到手机主屏幕, 离线也能用, 像原生 App 一样记账。')}</p>
      <div class="install-guide-steps">${list}</div>`;
    Util.modal({
      title: I18n.t('如何安装 App'),
      body,
      footer: `${cta}<button class="btn btn-ghost" data-act="close">${I18n.t('关闭')}</button>`,
    });
    const now = document.getElementById('ig-install-now');
    if (now) now.onclick = () => {
      try { deferredInstall.prompt(); } catch (e) {}
      deferredInstall = null;
      document.querySelector('.modal-mask')?.remove();
    };
  }
  window.__openInstallGuide = openInstallGuide;

  function setupInstallBanner() {
    const banner = document.getElementById('install-banner');
    if (!banner) return;
    const btn = document.getElementById('install-banner-btn');
    const x = document.getElementById('install-banner-x');
    const sub = document.getElementById('install-banner-sub');
    // 顶栏「安装」按钮负责桌面端引导; 移动端才弹横幅
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return;
    const ua = navigator.userAgent;
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/.test(ua));
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    if (!isMobile) return;
    if (localStorage.getItem('cfo:install-dismiss') === '1') return;

    function show() {
      if (isIOS) {
        if (sub) sub.textContent = I18n.t('iOS: 点 Safari 底部分享 → 添加到主屏幕');
        if (btn) { btn.textContent = I18n.t('知道了'); btn.onclick = () => { banner.classList.add('hidden'); localStorage.setItem('cfo:install-dismiss', '1'); }; }
      } else {
        if (sub) sub.textContent = I18n.t('添加到主屏幕, 像 App 一样随时记账');
        if (btn) {
          btn.textContent = I18n.t('安装');
          btn.onclick = () => {
            if (deferredInstall) { try { deferredInstall.prompt(); } catch (e) {} deferredInstall = null; }
            else { openInstallGuide(); }
            banner.classList.add('hidden');
          };
        }
      }
      banner.classList.remove('hidden');
    }
    if (isIOS) { setTimeout(show, 1200); }
    else if (deferredInstall) { show(); }
    else { setTimeout(show, 1500); } // beforeinstallprompt 可能在交互后才触发, 先给引导
    if (x) x.onclick = () => { banner.classList.add('hidden'); localStorage.setItem('cfo:install-dismiss', '1'); };

    // 绑定顶栏「安装到手机」按钮(所有设备通用入口)
    const ib = document.getElementById('install-app-btn');
    if (ib) ib.addEventListener('click', () => installApp());
  }
})();
