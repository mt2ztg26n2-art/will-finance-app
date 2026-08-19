/* =========================================================
   Router — 简易 Hash 路由
   ========================================================= */

const Router = (() => {
  const routes = {};
  let currentRoute = null;
  let beforeEachHook = null;

  function register(name, handler) {
    routes[name] = handler;
  }

  function beforeEach(fn) { beforeEachHook = fn; }

  function navigate(name, params = {}) {
    window.location.hash = `#/${name}${Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''}`;
  }

  function parseHash() {
    const raw = window.location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [name, qs] = raw.split('?');
    const params = Object.fromEntries(new URLSearchParams(qs || '').entries());
    return { name, params };
  }

  function handle() {
    const { name, params } = parseHash();
    const handler = routes[name];
    if (!handler) {
      navigate('dashboard');
      return;
    }
    if (beforeEachHook) {
      const canContinue = beforeEachHook(name, params);
      if (canContinue === false) return;
    }

    // UI 标记 active
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === name);
    });

    // 切换页面标题 (双语)
    const titles = {
      dashboard: ['总控面板', ''],
      quickInput: ['智能记账', '语音/文字,一键入账'],
      transactions: ['交易记录', '资金全路径追溯'],
      accounts: ['账户管理', '银行级多账户联动'],
      budgets: ['预算管理', '月度预算与超支预警'],
      monthlyReport: ['月度复盘', '收支结构/环比/创业小结'],
      education: ['教育投资', '按时间地点查看求学花费'],
      entrepreneurship: ['创业看板', '创业收支独立核算 · 利润追踪'],
      liabilities: ['负债管理', '花呗/信用卡/贷款 · 还款提醒'],
      pots: ['存钱罐', '自定义存钱与自动攒钱'],
      flow: ['资金流向', '桑基图可视化资金路径'],
      datacenter: ['数据中心', '财务总览 · 预算 · 流水 · 通知 一屏掌握'],
      yearlyReport: ['年度复盘', '12 月收支走势 · 储蓄率 · 分类排行'],
      audit: ['痕迹日志', '所有 CUD 操作的不可篡改留痕'],
      notifications: ['通知中心', '预算预警/大额提醒/还款提醒'],
      settings: ['设置', '系统配置与数据管理'],
    };
    const t = titles[name] || ['个人金融系统', ''];
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-subtitle');
    if (titleEl) titleEl.textContent = I18n.t(t[0]);
    if (subEl) subEl.textContent = I18n.t(t[1]);

    const view = document.getElementById('view');
    view.innerHTML = '<div class="empty"><div class="spinner"></div></div>';
    try {
      handler(view, params);
    } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="empty"><div class="empty-icon">${Util.icon('shield-alert')}</div><div class="empty-title">加载失败</div><div class="empty-desc">${Util.escapeHtml(String(e))}</div></div>`;
    }
    currentRoute = name;
    view.scrollTop = 0;
  }

  function init() {
    window.addEventListener('hashchange', handle);
  }

  function getCurrent() { return currentRoute; }

  return { register, navigate, handle, init, beforeEach, getCurrent };
})();
