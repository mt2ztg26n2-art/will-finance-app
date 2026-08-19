/* =========================================================
   View: Dashboard - 财务资产看板
   ========================================================= */

const DashboardView = (() => {

  function render(view) {
    const totals = Data.totals();
    const accounts = Data.getAccounts();
    const ym = Util.todayMonth();
    const [monthStart, monthEnd] = Util.monthRange(ym);
    const monthTxs = Data.getTransactions().filter(t => t.time >= monthStart && t.time < monthEnd);
    const monthIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const monthExpense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const autoCat = Data.getCategories().find(c => c.name === '自动攒钱');
    const monthDeduct = monthTxs.filter(t => t.type === 'expense' && autoCat && t.categoryId === autoCat.id).reduce((s, t) => s + t.amount, 0);

    const bizTxs = monthTxs.filter(t => {
      const cat = Data.getCategories().find(c => c.id === t.categoryId);
      return cat && (cat.category === 'business' || cat.name === '创业收入');
    });
    const bizIncome = bizTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const bizExpense = bizTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const bizProfit = bizIncome - bizExpense;

    const eduTotal = Data.getEducationStages().reduce((s, e) => s + (e.total || 0), 0);

    const budget = Data.getBudgets().find(b => b.yearMonth === ym && !b.categoryId);
    const budgetAmount = budget ? budget.amount : Data.getSettings().monthlyBudget || 3000;
    const budgetRatio = Math.min(1.5, monthExpense / Math.max(1, budgetAmount));
    const budgetStatus = budgetRatio > 1 ? 'over' : budgetRatio > 0.85 ? 'warn' : '';

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayTxs = monthTxs.filter(t => t.time >= today.getTime());
    const todayExpense = todayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const todayIncome = todayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);

    const saved = totals.totalSaved || 0;

    view.innerHTML = `
      <div class="print-toolbar no-print">
        <button class="btn btn-ghost" onclick="window.__nav('pots')">${Util.icon('wallet')} ${I18n.t('存钱罐')}</button>
        <button class="btn btn-ghost" onclick="window.__nav('datacenter')">${Util.icon('bar-chart')} ${I18n.t('数据报表')}</button>
      </div>

      <div class="page-header">
        <div class="page-header-ico">${Util.icon('grid')}</div>
        <div class="page-header-text">
          <h1>${I18n.t('仪表盘 · 我的财务总览')}</h1>
          <p>${I18n.t('截至 {d} · {n} 个账户 · 本月收支 {inc} / {exp}', { d: Util.fmtDate(Date.now()), n: accounts.length, inc: Util.fmtMoneyCompact(monthIncome), exp: Util.fmtMoneyCompact(monthExpense) })}</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-sm btn-ghost" onclick="window.__openTransfer()">${Util.icon('arrow-left-right')} ${I18n.t('转账')}</button>
          <button class="btn btn-sm btn-primary" onclick="window.__nav('quickInput')">${Util.icon('pen')} ${I18n.t('记一笔')}</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card" style="--kpi-color:var(--brand)"><div class="kpi-card-label">${I18n.t('总资产')}</div><div class="kpi-card-value">${Util.fmtMoney(totals.totalAssets)}</div><div class="kpi-card-sub">${I18n.t('{n} 个账户', { n: accounts.length })}</div></div>
        <div class="kpi-card" style="--kpi-color:var(--info)"><div class="kpi-card-label">${I18n.t('净资产')}</div><div class="kpi-card-value">${Util.fmtMoney(totals.netAssets)}</div><div class="kpi-card-sub">${I18n.t('资产 − 负债')}</div></div>
        <div class="kpi-card" style="--kpi-color:var(--down)"><div class="kpi-card-label">${I18n.t('总负债')}</div><div class="kpi-card-value">${Util.fmtMoney(totals.totalLiabilities)}</div><div class="kpi-card-sub">${I18n.t('{n} 笔负债', { n: Data.getLiabilities().length })}</div></div>
        <div class="kpi-card" style="--kpi-color:var(--warn)"><div class="kpi-card-label">${I18n.t('存钱罐总额')}</div><div class="kpi-card-value">${Util.fmtMoney(saved)}</div><div class="kpi-card-sub">${I18n.t('已攒入罐')}</div></div>
        <div class="kpi-card" style="--kpi-color:var(--up)"><div class="kpi-card-label">${I18n.t('本月收入')}</div><div class="kpi-card-value">${Util.fmtMoney(monthIncome)}</div><div class="kpi-card-sub">${I18n.t('储蓄率 {a}%', { a: (monthIncome > 0 ? Math.round((monthIncome - monthExpense) / monthIncome * 100) : 0) })}</div></div>
        <div class="kpi-card" style="--kpi-color:var(--down)"><div class="kpi-card-label">${I18n.t('本月支出')}</div><div class="kpi-card-value">${Util.fmtMoney(monthExpense)}</div><div class="kpi-card-sub">${I18n.t('占预算 {a}%', { a: Math.round(budgetRatio * 100) })}</div></div>
      </div>

      <!-- 资产看板：赚/花/剩/存/扣 五数总览 -->
      <div class="asset-board">
        <div class="ab-tile" style="--ab-color:#00b96b;--ab-soft:rgba(0,185,107,.12)">
          <div class="ab-ico">${Util.icon('arrow-down')}</div>
          <div class="ab-label">${I18n.t('赚了多少')}</div>
          <div class="ab-value">${Util.fmtMoney(monthIncome)}</div>
          <div class="ab-sub">${I18n.t('本月收入')}</div>
        </div>
        <div class="ab-tile" style="--ab-color:#ff4d4f;--ab-soft:rgba(255,77,79,.12)">
          <div class="ab-ico">${Util.icon('arrow-up')}</div>
          <div class="ab-label">${I18n.t('花了多少')}</div>
          <div class="ab-value">${Util.fmtMoney(monthExpense)}</div>
          <div class="ab-sub">${I18n.t('本月支出')}</div>
        </div>
        <div class="ab-tile" style="--ab-color:#0f5132;--ab-soft:rgba(15,81,50,.10)">
          <div class="ab-ico">${Util.icon('scale')}</div>
          <div class="ab-label">${I18n.t('剩多少')}</div>
          <div class="ab-value">${Util.fmtMoney(monthIncome - monthExpense)}</div>
          <div class="ab-sub">${I18n.t('本月结余')}</div>
        </div>
        <div class="ab-tile" style="--ab-color:#ff7d00;--ab-soft:rgba(255,125,0,.12)">
          <div class="ab-ico">${Util.icon('wallet')}</div>
          <div class="ab-label">${I18n.t('存了多少')}</div>
          <div class="ab-value">${Util.fmtMoney(saved)}</div>
          <div class="ab-sub">${I18n.t('存钱罐总额')}</div>
        </div>
        <div class="ab-tile" style="--ab-color:#9254de;--ab-soft:rgba(146,84,222,.12)">
          <div class="ab-ico">${Util.icon('refresh-cw')}</div>
          <div class="ab-label">${I18n.t('扣了多少')}</div>
          <div class="ab-value">${Util.fmtMoney(monthDeduct)}</div>
          <div class="ab-sub">${I18n.t('本月自动扣款')}</div>
        </div>
      </div>

      <!-- 趋势图 + 预算 -->
      <div class="dash-row">
        <div class="card">
          <div class="card-title">
            <div class="card-title-text"><span class="card-title-icon">${Util.icon('line-chart')}</span>${I18n.t('本月收支趋势 (近 30 天)')}</div>
            <button class="btn btn-sm btn-ghost" onclick="window.__nav('monthlyReport')">${I18n.t('查看月度复盘')} →</button>
          </div>
          <div style="height:280px; position:relative;"><canvas id="dash-trend-chart"></canvas></div>
        </div>

        <div class="card">
          <div class="card-title">
            <div class="card-title-text"><span class="card-title-icon">${Util.icon('target')}</span>${Util.monthLabel(ym)} ${I18n.t('预算进度')}</div>
            <a class="card-title-text link-muted" onclick="window.__nav('budgets')" style="cursor:pointer;font-size:12px;">${I18n.t('调整')} →</a>
          </div>
          ${budget ? `
            <div style="margin-top: 6px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span style="color:var(--text-2); font-size:12px;">${I18n.t('已支出 / 预算')}</span>
                <span style="font-weight:700;">${(budgetRatio * 100).toFixed(0)}%</span>
              </div>
              <div class="gauge">
                <div class="gauge-bar"><div class="gauge-fill ${budgetStatus}" style="width: ${Math.min(100, budgetRatio * 100)}%;"></div></div>
                <div class="gauge-meta"><span>${Util.fmtMoney(monthExpense)}</span><span>${Util.fmtMoney(budgetAmount)}</span></div>
              </div>
            </div>
            <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text-2);">${I18n.t('本月结余')}</span><span style="font-weight:700;">${Util.fmtMoney(monthIncome - monthExpense)}</span></div>
              <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text-2);">${I18n.t('创业利润')}</span><span class="${bizProfit >= 0 ? 'tag-success' : 'tag-danger'}" style="font-weight:700;">${Util.fmtMoney(bizProfit)}</span></div>
              <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text-2);">${I18n.t('教育累计')}</span><span style="font-weight:700;">${Util.fmtMoneyCompact(eduTotal)}</span></div>
            </div>
          ` : `<div class="empty"><div class="empty-desc">${I18n.t('未设置预算')}</div></div>`}
        </div>
      </div>

      <!-- 最近交易 + 我的账户 -->
      <div class="dash-row">
        <div class="card" style="padding:0;">
          <div class="ap-list-header">${I18n.t('最近交易')}<span class="more" onclick="window.__nav('transactions')">${I18n.t('全部')} →</span></div>
          <div class="tx-list" id="dash-tx-list"></div>
        </div>
        <div class="card" style="padding:0;">
          <div class="ap-list-header">${I18n.t('我的账户')} (${accounts.filter(a => a.type !== 'liability').length})<span class="more" onclick="window.__nav('accounts')">${I18n.t('全部')} →</span></div>
          <div class="ap-list" id="dash-accounts" style="border:0; border-radius:0;"></div>
        </div>
      </div>
    `;

    renderAccounts(accounts);
    renderTxList();
    renderTrendChart();
  }

  function renderAccounts(accounts) {
    const container = document.getElementById('dash-accounts');
    if (!container) return;
    const list = accounts.filter(a => a.type !== 'liability').slice(0, 6);
    if (!list.length) { container.innerHTML = '<div class="empty"><div class="empty-desc">' + I18n.t('还没有账户') + '</div></div>'; return; }
    container.innerHTML = list.map(a => {
      const isNeg = (a.balance || 0) < 0;
      return `
        <div class="ap-row" onclick="window.__nav('accounts')">
          <span class="ap-row-ico">${Util.icon(Util.accountIcon(a.type))}</span>
          <div class="ap-row-text"><div class="ap-row-title">${Util.escapeHtml(a.name)}</div><div class="ap-row-sub">${Util.escapeHtml(a.number || '—')}</div></div>
          <div class="ap-row-amount ${isNeg ? 'negative' : ''}">${Util.fmtMoney(a.balance)}</div>
          <svg class="ap-row-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>`;
    }).join('');
  }

  function renderTxList() {
    const container = document.getElementById('dash-tx-list');
    if (!container) return;
    const txs = Data.getTransactions().slice(0, 8);
    const accounts = Data.getAccounts();
    const categories = Data.getCategories();
    if (!txs.length) { container.innerHTML = '<div class="empty"><div class="empty-desc">' + I18n.t('还没有交易记录') + '</div></div>'; return; }
    container.innerHTML = txs.map(tx => {
      const acc = accounts.find(a => a.id === tx.accountId);
      const cat = categories.find(c => c.id === tx.categoryId);
      let sign = '', cls = '', txIcon = 'arrow-left-right';
      if (tx.type === 'income') { sign = '+'; cls = 'in'; txIcon = 'arrow-down'; }
      else if (tx.type === 'expense') { sign = '-'; cls = 'out'; txIcon = 'arrow-up'; }
      else { sign = ''; cls = 'transfer'; }
      return `
        <div class="tx-item" onclick="window.__openTx('${tx.id}')">
          <div class="tx-icon ${cls}">${Util.icon(txIcon)}</div>
          <div class="tx-main">
            <p class="tx-title">${Util.escapeHtml(cat ? cat.name : tx.type)}${tx.payee ? ' · ' + Util.escapeHtml(tx.payee) : ''}</p>
            <div class="tx-meta"><span>${Util.fmtDate(tx.time)} ${Util.fmtTime(tx.time)}</span><span>·</span><span>${acc ? Util.escapeHtml(acc.name) : '?'}</span>${tx.location ? `<span>· ${Util.escapeHtml(tx.location)}</span>` : ''}</div>
          </div>
          <div class="tx-amount ${cls}">${sign}${Util.fmtMoney(tx.amount)}</div>
        </div>`;
    }).join('');
  }

  let trendChart = null;
  function renderTrendChart() {
    const ctx = document.getElementById('dash-trend-chart');
    if (!ctx) return;
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    const ct = Util.chartTheme();

    const days = 30;
    const labels = [];
    const incomeData = [];
    const expenseData = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const allTxs = Data.getTransactions();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400_000);
      const dayStart = d.getTime();
      const dayEnd = dayStart + 86400_000;
      const dayTxs = allTxs.filter(t => t.time >= dayStart && t.time < dayEnd);
      incomeData.push(dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
      expenseData.push(dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    }

    trendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: I18n.t('收入'), data: incomeData, backgroundColor: 'rgba(0,185,107,.82)', borderColor: '#00b96b', borderWidth: 1, borderRadius: 4 },
          { label: I18n.t('支出'), data: expenseData.map(n => -n), backgroundColor: 'rgba(255,77,79,.82)', borderColor: '#ff4d4f', borderWidth: 1, borderRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { color: ct.text, font: { size: 11 } } },
          tooltip: {
            callbacks: { label: (ctx) => { const v = Math.abs(ctx.parsed.y); return `${ctx.dataset.label}: ¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`; } },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: ct.tick, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: {
            grid: { color: ct.grid },
            ticks: { color: ct.tick, callback: (v) => (v < 0 ? '-' : '') + '¥' + Math.abs(v).toLocaleString('zh-CN') },
          },
        },
      },
    });
  }

  return { render };
})();
