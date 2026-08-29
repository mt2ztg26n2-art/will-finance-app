const App = (() => {
  function checkConfig() {
    return window.WF_CONFIG && window.WF_CONFIG.isValid();
  }

  function makeClient() {
    if (!checkConfig()) return null;
    if (!window.supabase) return null;
    return window.supabase.createClient(window.WF_CONFIG.SUPABASE_URL, window.WF_CONFIG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(e.style, attrs[k]);
      else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  const CATEGORIES = {
    expense: [
      { id: 'food', name: '餐饮', icon: '🍜' },
      { id: 'transport', name: '交通', icon: '🚌' },
      { id: 'study', name: '学习', icon: '📚' },
      { id: 'startup', name: '创业投入', icon: '🚀' },
      { id: 'shopping', name: '购物', icon: '🛍️' },
      { id: 'entertain', name: '娱乐', icon: '🎮' },
      { id: 'rent', name: '住宿', icon: '🏠' },
      { id: 'other', name: '其他', icon: '📦' }
    ],
    income: [
      { id: 'parttime', name: '兼职', icon: '💼' },
      { id: 'family', name: '家人', icon: '👨‍👩‍👧' },
      { id: 'scholarship', name: '奖学金', icon: '🎓' },
      { id: 'startup_in', name: '创业收入', icon: '💰' },
      { id: 'invest', name: '投资', icon: '📈' },
      { id: 'gift', name: '红包', icon: '🧧' },
      { id: 'salary', name: '工资', icon: '💵' },
      { id: 'other_in', name: '其他', icon: '✨' }
    ]
  };

  const state = {
    sb: null, user: null, tab: 'home',
    transactions: [], budgets: [],
    currency: '¥'
  };

  async function boot() {
    if (!checkConfig()) {
      document.body.innerHTML = `<div class="auth-wrap"><div class="auth-card"><h1>需要先配置 Supabase</h1><p class="sub">请填入 supabase-config.js 里的 URL 和 key。</p></div></div>`;
      return;
    }
    if (!window.supabase) { toast('Supabase SDK 加载失败'); return; }

    state.sb = makeClient();
    window.WF_Auth.init(state.sb);
    window.WF_Sync.init(state.sb, null);

    window.WF_Auth.onAuthStateChange(async (event, session) => {
      const u = session?.user || null;
      if (u && !state.user) await enterApp(u);
      else if (!u && state.user) await leaveApp();
      else if (u && event === 'PASSWORD_RECOVERY') showPasswordUpdate();
    });

    const session = await window.WF_Auth.currentSession();
    if (session?.user) await enterApp(session.user);
    else showAuth();
  }

  function showAuth() {
    document.body.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
            <div class="brand-mark" style="width:44px;height:44px;border-radius:12px;font-size:22px;">W</div>
            <div><h1 style="margin:0;font-size:22px;">Will Finance</h1><p class="sub" style="margin:2px 0 0;">学生财务 & 创业资金管理</p></div>
          </div>
          <div id="auth-forms">
            <form id="form-login" autocomplete="on">
              <div class="field"><label>邮箱</label><input type="email" name="email" required placeholder="you@example.com"/></div>
              <div class="field"><label>密码</label><input type="password" name="password" required minlength="6" placeholder="至少 6 位"/></div>
              <div id="login-error" class="hint danger" style="margin:-4px 0 10px;"></div>
              <div class="auth-actions">
                <button class="btn btn-primary btn-block" type="submit">登 录</button>
                <button class="btn btn-ghost btn-block" type="button" id="go-register">没账号？立即注册</button>
              </div>
              <div class="auth-switch"><a id="go-reset">忘记密码？</a></div>
            </form>
            <form id="form-register" autocomplete="on" style="display:none;">
              <div class="field"><label>邮箱</label><input type="email" name="email" required placeholder="you@example.com"/></div>
              <div class="field"><label>密码</label><input type="password" name="password" required minlength="6" placeholder="至少 6 位"/></div>
              <div class="field"><label>确认密码</label><input type="password" name="password2" required minlength="6"/></div>
              <div id="register-error" class="hint danger" style="margin:-4px 0 10px;"></div>
              <div id="register-success" class="hint success" style="margin:-4px 0 10px;"></div>
              <div class="auth-actions">
                <button class="btn btn-primary btn-block" type="submit">注册并登录</button>
                <button class="btn btn-ghost btn-block" type="button" id="go-login">已有账号，去登录</button>
              </div>
            </form>
            <form id="form-reset" autocomplete="on" style="display:none;">
              <p class="sub" style="margin-bottom:14px;">输入注册邮箱，我们会发一封重置密码的链接给你。</p>
              <div class="field"><label>邮箱</label><input type="email" name="email" required placeholder="you@example.com"/></div>
              <div id="reset-error" class="hint danger" style="margin:-4px 0 10px;"></div>
              <div id="reset-success" class="hint success" style="margin:-4px 0 10px;"></div>
              <div class="auth-actions">
                <button class="btn btn-primary btn-block" type="submit">发送重置链接</button>
                <button class="btn btn-ghost btn-block" type="button" id="back-login">返回登录</button>
              </div>
            </form>
            <form id="form-pwupdate" autocomplete="on" style="display:none;">
              <p class="sub" style="margin-bottom:14px;">通过邮件链接进入。请设置一个新的密码。</p>
              <div class="field"><label>新密码</label><input type="password" name="pw1" required minlength="6"/></div>
              <div class="field"><label>确认新密码</label><input type="password" name="pw2" required minlength="6"/></div>
              <div id="pwupdate-error" class="hint danger" style="margin:-4px 0 10px;"></div>
              <div class="auth-actions">
                <button class="btn btn-primary btn-block" type="submit">更新密码</button>
              </div>
            </form>
          </div>
        </div>
        <p class="muted" style="margin-top:18px;font-size:12px;">数据真云端 · 多设备实时同步 · 永不丢失</p>
      </div>
      <div id="toast" class="toast"></div>`;
    $('#go-register').addEventListener('click', () => toggleForms('register'));
    $('#go-login').addEventListener('click', () => toggleForms('login'));
    $('#go-reset').addEventListener('click', () => toggleForms('reset'));
    $('#back-login').addEventListener('click', () => toggleForms('login'));
    $('#form-login').addEventListener('submit', onLogin);
    $('#form-register').addEventListener('submit', onRegister);
    $('#form-reset').addEventListener('submit', onReset);
    $('#form-pwupdate').addEventListener('submit', onUpdatePassword);
  }
  function toggleForms(which) {
    $('#form-login').style.display = which === 'login' ? '' : 'none';
    $('#form-register').style.display = which === 'register' ? '' : 'none';
    $('#form-reset').style.display = which === 'reset' ? '' : 'none';
    $('#form-pwupdate').style.display = which === 'pwupdate' ? '' : 'none';
    ['login-error','register-error','register-success','reset-error','reset-success','pwupdate-error']
      .forEach(id => { const e = document.getElementById(id); if (e) e.textContent = ''; });
  }
  function showPasswordUpdate() { showAuth(); toggleForms('pwupdate'); }
  async function onLogin(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    $('#login-error').textContent = '';
    try { await window.WF_Auth.signIn(fd.get('email'), fd.get('password')); }
    catch (err) { $('#login-error').textContent = err.message || '登录失败'; }
  }
  async function onRegister(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errBox = $('#register-error'); const okBox = $('#register-success');
    errBox.textContent = ''; okBox.textContent = '';
    if (fd.get('password') !== fd.get('password2')) { errBox.textContent = '两次密码不一致'; return; }
    try { await window.WF_Auth.signUp(fd.get('email'), fd.get('password')); okBox.textContent = '注册成功！正在自动登录...'; }
    catch (err) { errBox.textContent = err.message || '注册失败'; }
  }
  async function onReset(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errBox = $('#reset-error'); const okBox = $('#reset-success');
    errBox.textContent = ''; okBox.textContent = '';
    try { await window.WF_Auth.resetPassword(fd.get('email')); okBox.textContent = '重置链接已发送，请查收邮箱'; }
    catch (err) { errBox.textContent = err.message || '发送失败'; }
  }
  async function onUpdatePassword(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errBox = $('#pwupdate-error'); errBox.textContent = '';
    if (fd.get('pw1') !== fd.get('pw2')) { errBox.textContent = '两次密码不一致'; return; }
    try {
      await window.WF_Auth.updatePassword(fd.get('pw1'));
      errBox.classList.remove('danger'); errBox.classList.add('success');
      errBox.textContent = '密码已更新，正在进入应用...';
      setTimeout(() => location.replace(location.pathname), 1000);
    } catch (err) { errBox.textContent = err.message || '更新失败'; }
  }

  async function enterApp(user) {
    state.user = user;
    window.WF_Storage.init(state.sb, user);
    window.WF_Sync.init(state.sb, user);
    window.WF_Storage.setUser(user);
    renderShell();
    await refreshAll();
    updateSyncDot(navigator.onLine ? 'online' : 'offline');
    window.WF_Sync.setStatusCallback((s) => updateSyncDot(s));
    window.WF_Sync.subscribe(async (event) => {
      if (event === 'refresh' || event === 'syncEnd') await refreshAll();
    });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
    toast('已登录 · 数据已从云端同步');
  }

  async function leaveApp() {
    state.user = null;
    await window.WF_Auth.signOut();
    location.reload();
  }

  function renderShell() {
    document.body.innerHTML = `
      <div class="app">
        <header class="topbar">
          <div class="brand"><div class="brand-mark">W</div><span>Will Finance</span></div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="sync-dot" id="sync-dot" title="同步状态"></span>
            <button class="btn btn-sm" id="btn-signout" style="padding:8px 10px;">退出</button>
          </div>
        </header>
        <main>
          <section class="page active" id="page-home"></section>
          <section class="page" id="page-tx"></section>
          <section class="page" id="page-budget"></section>
          <section class="page" id="page-funds"></section>
          <section class="page" id="page-profile"></section>
        </main>
        <nav class="tabbar" id="tabbar">
          <button data-tab="home" class="active"><span class="ico">🏠</span><span>首页</span></button>
          <button data-tab="tx"><span class="ico">📊</span><span>明细</span></button>
          <button data-tab="budget"><span class="ico">🎯</span><span>预算</span></button>
          <button data-tab="funds"><span class="ico">🚀</span><span>资金</span></button>
          <button data-tab="profile"><span class="ico">👤</span><span>我的</span></button>
        </nav>
      </div>
      <div id="toast" class="toast"></div>
      <div id="sheet-mask" class="sheet-mask"><div class="sheet" id="sheet"></div></div>`;
    $('#btn-signout').addEventListener('click', async () => {
      if (!confirm('确认退出登录？数据已存云端。')) return;
      await leaveApp();
    });
    $$('#tabbar button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    renderHome(); renderTx(); renderBudget(); renderFunds(); renderProfile();
    switchTab('home');
  }
  function switchTab(tab) {
    state.tab = tab;
    $$('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + tab));
  }
  function updateSyncDot(s) {
    const d = $('#sync-dot'); if (!d) return;
    d.classList.remove('offline', 'error');
    if (s === 'offline') d.classList.add('offline');
    if (s === 'error') d.classList.add('error');
  }
  async function refreshAll() {
    if (!state.user) return;
    const { data: txs } = await window.WF_Storage.fetchAll('transactions');
    state.transactions = txs;
    const { data: bs } = await window.WF_Storage.fetchAll('budgets');
    state.budgets = bs;
    renderHome(); renderTx(); renderBudget(); renderFunds();
  }
  function sumByCat(rows) {
    const map = {};
    rows.forEach(r => { map[r.category] = (map[r.category] || 0) + Number(r.amount || 0); });
    return map;
  }
  function totals() {
    let inc = 0, exp = 0, study = 0, startup = 0;
    state.transactions.forEach(t => {
      const a = Number(t.amount || 0);
      if (t.type === 'income') inc += a;
      else exp += a;
      if (t.category === 'study') study += a;
      if (t.category === 'startup') startup += a;
    });
    return { inc, exp, balance: inc - exp, study, startup };
  }
  function renderHome() {
    const p = $('#page-home'); if (!p) return;
    const t = totals();
    const today = new Date().toISOString().slice(0,10);
    const todayTxs = state.transactions.filter(x => (x.created_at || '').slice(0,10) === today);
    const month = new Date().toISOString().slice(0,7);
    const monthExp = state.transactions.filter(x => x.type === 'expense' && (x.created_at || '').startsWith(month))
      .reduce((s, x) => s + Number(x.amount), 0);
    p.innerHTML = `
      <h1 class="page-title">概览</h1>
      <div class="balance-card">
        <div class="label">本月结余</div>
        <div class="amount">${state.currency}${t.balance.toFixed(2)}</div>
        <div class="row">
          <div><div class="k">本月支出</div><div class="v">${state.currency}${monthExp.toFixed(2)}</div></div>
          <div><div class="k">本月收入</div><div class="v">${state.currency}${t.inc.toFixed(2)}</div></div>
        </div>
      </div>
      <div class="quick-add">
        <button class="btn" id="qa-expense" style="background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#fecaca;">− 记一笔支出</button>
        <button class="btn" id="qa-income" style="background:rgba(34,197,94,0.15);border-color:rgba(34,197,94,0.4);color:#bbf7d0;">+ 记一笔收入</button>
      </div>
      <h2 class="section-title">今日</h2>
      <div class="list">${todayTxs.length === 0 ? '<div class="empty">今天还没有记录</div>' : todayTxs.slice(0, 8).map(itemRowHTML).join('')}</div>
      <h2 class="section-title">最近</h2>
      <div class="list">${state.transactions.slice(0, 5).map(itemRowHTML).join('') || '<div class="empty">还没有数据</div>'}</div>`;
    $('#qa-expense').addEventListener('click', () => openTxSheet('expense'));
    $('#qa-income').addEventListener('click', () => openTxSheet('income'));
    bindListDelegation(p);
  }
  function itemRowHTML(t) {
    const cat = (CATEGORIES[t.type] || []).find(c => c.id === t.category) || { name: t.category, icon: '📌' };
    const sign = t.type === 'expense' ? '-' : '+';
    return `<div class="item ${t.type}" data-id="${t.id}">
      <div class="icon">${cat.icon}</div>
      <div class="meta"><div class="name">${escapeHTML(t.note || cat.name)}</div>
      <div class="sub">${formatDate(t.created_at)} · ${cat.name}${t._pending ? ' · 待同步' : ''}</div></div>
      <div class="amount ${t.type}">${sign}${state.currency}${Number(t.amount).toFixed(2)}</div>
    </div>`;
  }
  function bindListDelegation(root) {
    root.addEventListener('click', (e) => {
      const item = e.target.closest('.item'); if (!item) return;
      const tx = state.transactions.find(x => x.id === item.dataset.id);
      if (tx) openTxSheet(tx.type, tx);
    });
  }
  function renderTx() {
    const p = $('#page-tx'); if (!p) return;
    const filter = p.dataset.filter || 'all';
    const rows = filter === 'all' ? state.transactions : state.transactions.filter(x => x.type === filter);
    const groups = {};
    rows.forEach(r => { const d = (r.created_at || '').slice(0,10) || '未知'; (groups[d] = groups[d] || []).push(r); });
    const html = Object.entries(groups).map(([d, list]) => `
      <h2 class="section-title">${formatDay(d)} <span style="float:right;color:var(--text-mute);font-weight:normal;text-transform:none;letter-spacing:0;">共 ${list.length} 笔</span></h2>
      <div class="list">${list.map(itemRowHTML).join('')}</div>
    `).join('') || '<div class="empty">还没有记录</div>';
    p.innerHTML = `<h1 class="page-title">明细</h1>
      <div class="switch-row" id="tx-filter">
        <button data-f="all" class="${filter==='all'?'active':''}">全部</button>
        <button data-f="expense" class="${filter==='expense'?'active':''}">支出</button>
        <button data-f="income" class="${filter==='income'?'active':''}">收入</button>
      </div>${html}`;
    $$('#tx-filter button').forEach(b => b.addEventListener('click', () => { p.dataset.filter = b.dataset.f; renderTx(); }));
    bindListDelegation(p);
  }
  function renderBudget() {
    const p = $('#page-budget'); if (!p) return;
    const month = new Date().toISOString().slice(0,7);
    const monthTxs = state.transactions.filter(x => x.type === 'expense' && (x.created_at || '').startsWith(month));
    const expByCat = sumByCat(monthTxs);
    const cardsHTML = state.budgets.map(b => {
      const used = expByCat[b.category] || 0;
      const pct = Math.min(100, Math.round(used / b.amount * 100));
      const cat = (CATEGORIES.expense).find(c => c.id === b.category) || { name: b.category, icon: '📌' };
      return `<div class="card"><div class="row-between">
        <div style="display:flex;gap:10px;align-items:center;">
          <div class="icon" style="width:36px;height:36px;border-radius:10px;background:rgba(99,102,241,.15);display:flex;align-items:center;justify-content:center;">${cat.icon}</div>
          <div><div style="font-weight:600;">${cat.name}</div><div class="muted" style="font-size:12px;">已用 ${pct}%</div></div>
        </div>
        <div style="text-align:right;"><div style="font-weight:700;">${state.currency}${used.toFixed(0)} / ${state.currency}${b.amount.toFixed(0)}</div>
        <button class="btn btn-sm btn-danger" data-del-budget="${b.id}" style="padding:6px 10px;font-size:12px;margin-top:4px;">删除</button></div>
      </div>
      <div class="bar mt-12"><span class="${pct >= 90 ? 'warn' : ''}" style="width:${pct}%"></span></div></div>`;
    }).join('') || '<div class="empty">还没设置预算</div>';
    p.innerHTML = `<h1 class="page-title">月度预算</h1>
      <button class="btn btn-primary btn-block" id="add-budget">+ 新增预算类别</button>
      <div class="mt-16">${cardsHTML}</div>`;
    $('#add-budget').addEventListener('click', openBudgetSheet);
    $$('[data-del-budget]').forEach(b => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('删除该预算？')) return;
      try { await window.WF_Storage.remove('budgets', b.dataset.delBudget); toast('已删除'); await refreshAll(); }
      catch (err) { toast('删除失败：' + err.message); }
    }));
  }
  function renderFunds() {
    const p = $('#page-funds'); if (!p) return;
    const t = totals();
    p.innerHTML = `
      <h1 class="page-title">教育 & 创业资金追踪</h1>
      <div class="card"><div class="muted" style="font-size:13px;">按你的「学习」与「创业投入」类支出自动累计。</div></div>
      <div class="card mt-16"><div style="display:flex;align-items:center;gap:10px;">
        <div class="icon" style="width:40px;height:40px;border-radius:12px;background:rgba(99,102,241,.15);display:flex;align-items:center;justify-content:center;font-size:20px;">📚</div>
        <div style="flex:1;"><div style="font-weight:600;">教育投入</div><div class="muted" style="font-size:12px;">「学习」分类累计</div></div>
        <div style="font-weight:800;font-size:18px;">${state.currency}${t.study.toFixed(2)}</div>
      </div></div>
      <div class="card mt-16"><div style="display:flex;align-items:center;gap:10px;">
        <div class="icon" style="width:40px;height:40px;border-radius:12px;background:rgba(34,211,238,.15);display:flex;align-items:center;justify-content:center;font-size:20px;">🚀</div>
        <div style="flex:1;"><div style="font-weight:600;">创业投入</div><div class="muted" style="font-size:12px;">「创业投入」分类累计</div></div>
        <div style="font-weight:800;font-size:18px;">${state.currency}${t.startup.toFixed(2)}</div>
      </div></div>
      <h2 class="section-title">详细记录</h2>
      <div class="list">${state.transactions.filter(x => x.category === 'study' || x.category === 'startup').map(itemRowHTML).join('') || '<div class="empty">还没有相关记录</div>'}</div>`;
    bindListDelegation(p);
  }
  function renderProfile() {
    const p = $('#page-profile'); if (!p) return;
    p.innerHTML = `
      <h1 class="page-title">我的</h1>
      <div class="card"><div style="display:flex;align-items:center;gap:12px;">
        <div class="brand-mark" style="width:48px;height:48px;font-size:22px;">${(state.user?.email || '?')[0].toUpperCase()}</div>
        <div style="min-width:0;"><div style="font-weight:700;">${escapeHTML(state.user?.email || '')}</div>
        <div class="muted" style="font-size:12px;">UID: ${state.user?.id?.slice(0,8) || '-'}</div></div>
      </div></div>
      <h2 class="section-title">数据</h2>
      <div class="list">
        <button class="item" id="btn-export" style="cursor:pointer;"><div class="icon">⬇️</div><div class="meta"><div class="name">导出我的数据 (JSON)</div><div class="sub">本地下载一份备份</div></div></button>
        <button class="item" id="btn-clear-cache" style="cursor:pointer;"><div class="icon">🧹</div><div class="meta"><div class="name">清除本地缓存</div><div class="sub">只清本机缓存，不影响云端</div></div></button>
      </div>
      <h2 class="section-title">安全</h2>
      <div class="list">
        <button class="item" id="btn-signout2" style="cursor:pointer;"><div class="icon danger" style="background:rgba(239,68,68,.15);color:#fecaca;">🚪</div><div class="meta"><div class="name danger">退出登录</div><div class="sub">数据已存云端</div></div></button>
      </div>
      <h2 class="section-title">关于</h2>
      <div class="card"><div class="muted">Will Finance · 学生财务与创业资金管理</div>
      <div class="muted" style="margin-top:6px;font-size:12px;">所有数据存储于 Supabase 云端数据库，跨设备实时同步。</div></div>`;
    $('#btn-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state.transactions, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: 'will-finance-' + Date.now() + '.json' });
      a.click(); URL.revokeObjectURL(url);
      toast('已导出');
    });
    $('#btn-clear-cache').addEventListener('click', () => {
      if (!confirm('确认清除本机缓存？云端数据不受影响。')) return;
      window.WF_Storage.wipeLocalCache();
      toast('已清除');
    });
    $('#btn-signout2').addEventListener('click', async () => {
      if (!confirm('确认退出？数据已在云端。')) return;
      await leaveApp();
    });
  }
  async function openTxSheet(type, tx = null) {
    const sheet = $('#sheet'); const mask = $('#sheet-mask');
    const isEdit = !!tx;
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="switch-row" id="tx-type"><button data-t="expense" class="${type==='expense'?'active':''}">支出</button><button data-t="income" class="${type==='income'?'active':''}">收入</button></div>
      <div class="field"><label>金额</label><input type="number" id="tx-amount" step="0.01" min="0" placeholder="0.00" value="${tx ? tx.amount : ''}"/></div>
      <div class="field"><label>分类</label><div class="cat-grid" id="tx-cats">${(CATEGORIES[type]).map(c => `<button data-c="${c.id}" class="${tx && tx.category===c.id ? 'active' : ''}"><span class="ci">${c.icon}</span>${c.name}</button>`).join('')}</div></div>
      <div class="field"><label>备注</label><input type="text" id="tx-note" value="${tx ? escapeHTML(tx.note || '') : ''}"/></div>
      <div class="field"><label>日期</label><input type="date" id="tx-date" value="${tx ? tx.created_at.slice(0,10) : new Date().toISOString().slice(0,10)}"/></div>
      <div class="auth-actions mt-12">
        <button class="btn btn-primary btn-block" id="tx-save">${isEdit ? '保存修改' : '保存'}</button>
        ${isEdit ? '<button class="btn btn-danger btn-block" id="tx-del">删除这笔</button>' : ''}
        <button class="btn btn-ghost btn-block" id="tx-cancel">取消</button>
      </div>`;
    mask.classList.add('show');
    let chosen = tx ? tx.category : (CATEGORIES[type][0].id);
    $$('#tx-type button').forEach(b => b.addEventListener('click', () => {
      type = b.dataset.t;
      $$('#tx-type button').forEach(x => x.classList.toggle('active', x === b));
      $('#tx-cats').innerHTML = (CATEGORIES[type]).map(c => `<button data-c="${c.id}"><span class="ci">${c.icon}</span>${c.name}</button>`).join('');
      chosen = CATEGORIES[type][0].id;
      bindCats();
    }));
    function bindCats() { $$('#tx-cats button').forEach(btn => btn.addEventListener('click', () => { chosen = btn.dataset.c; $$('#tx-cats button').forEach(x => x.classList.toggle('active', x === btn)); })); }
    bindCats();
    const initBtn = $(`#tx-cats button[data-c="${chosen}"]`); if (initBtn) initBtn.classList.add('active');
    $('#tx-cancel').addEventListener('click', closeSheet);
    mask.addEventListener('click', (e) => { if (e.target === mask) closeSheet(); }, { once: true });
    $('#tx-save').addEventListener('click', async () => {
      const amount = parseFloat($('#tx-amount').value);
      if (!amount || amount <= 0) { toast('请输入金额'); return; }
      const note = $('#tx-note').value.trim();
      const date = $('#tx-date').value;
      const created_at = date ? new Date(date + 'T12:00:00').toISOString() : new Date().toISOString();
      try {
        if (isEdit) { await window.WF_Storage.update('transactions', tx.id, { amount, category: chosen, note, created_at, type }); toast('已更新'); }
        else { await window.WF_Storage.insert('transactions', { amount, category: chosen, note, created_at, type }); toast('已保存到云端'); }
        await refreshAll(); closeSheet();
      } catch (err) { toast('保存失败：' + err.message); }
    });
    if (isEdit) {
      $('#tx-del').addEventListener('click', async () => {
        if (!confirm('删除这笔？')) return;
        try { await window.WF_Storage.remove('transactions', tx.id); toast('已删除'); await refreshAll(); closeSheet(); }
        catch (err) { toast('删除失败：' + err.message); }
      });
    }
  }
  function openBudgetSheet() {
    const sheet = $('#sheet'); const mask = $('#sheet-mask');
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h2 style="margin:0 0 12px;">新增预算</h2>
      <div class="field"><label>分类</label><div class="cat-grid" id="bg-cats">${CATEGORIES.expense.map(c => `<button data-c="${c.id}"><span class="ci">${c.icon}</span>${c.name}</button>`).join('')}</div></div>
      <div class="field"><label>每月预算金额</label><input type="number" id="bg-amount" min="0" step="0.01" placeholder="例如 800"/></div>
      <div class="auth-actions mt-12">
        <button class="btn btn-primary btn-block" id="bg-save">保存</button>
        <button class="btn btn-ghost btn-block" id="bg-cancel">取消</button>
      </div>`;
    mask.classList.add('show');
    let chosen = CATEGORIES.expense[0].id;
    const initBtn = $(`#bg-cats button[data-c="${chosen}"]`); if (initBtn) initBtn.classList.add('active');
    $$('#bg-cats button').forEach(btn => btn.addEventListener('click', () => { chosen = btn.dataset.c; $$('#bg-cats button').forEach(x => x.classList.toggle('active', x === btn)); }));
    $('#bg-cancel').addEventListener('click', closeSheet);
    mask.addEventListener('click', (e) => { if (e.target === mask) closeSheet(); }, { once: true });
    $('#bg-save').addEventListener('click', async () => {
      const amount = parseFloat($('#bg-amount').value);
      if (!amount || amount <= 0) { toast('请输入金额'); return; }
      try { await window.WF_Storage.insert('budgets', { category: chosen, amount }); toast('已添加'); await refreshAll(); closeSheet(); }
      catch (err) { toast('保存失败：' + err.message); }
    });
  }
  function closeSheet() { $('#sheet-mask').classList.remove('show'); }
  function escapeHTML(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return `${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  }
  function formatDay(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const today = new Date(); today.setHours(0,0,0,0);
    const dt = new Date(d); dt.setHours(0,0,0,0);
    if (dt.getTime() === today.getTime()) return '今天';
    const y = new Date(today); y.setDate(y.getDate()-1);
    if (dt.getTime() === y.getTime()) return '昨天';
    return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
  }
  return { boot };
})();

document.addEventListener('DOMContentLoaded', App.boot);
