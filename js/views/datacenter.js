/* =========================================================
   View: 数据中心 (Data Center) — 核心中枢 · 全局总览
   预算 · 流水 · 存钱罐 · 通知 · 痕迹 全部联动
   ========================================================= */

const DataCenterView = (() => {

  let charts = {};
  function destroyCharts() { Object.values(charts).forEach(c => c && c.destroy()); charts = {}; }

  const sum = (arr, type) => arr.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount || 0), 0);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const byCatName = (cat) => cat ? cat.name : I18n.t('未分类');
  const sign = (t) => t.type === 'income' ? '+' : (t.type === 'expense' ? '-' : '');

  function getLastNMonths(txs, n) {
    const map = {};
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[ym] = { ym, income: 0, expense: 0, profit: 0 };
    }
    txs.forEach(t => {
      const ym = Util.fmtMonth(t.time);
      if (map[ym]) {
        if (t.type === 'income') map[ym].income += Number(t.amount || 0);
        else if (t.type === 'expense') map[ym].expense += Number(t.amount || 0);
      }
    });
    return Object.values(map);
  }

  function render(view) {
    destroyCharts();

    const totals = Data.totals();
    const accounts = Data.getAccounts();
    const txs = Data.getTransactions();
    const cats = Data.getCategories();
    const budgets = Data.getBudgets();
    const edu = Data.getEducationStages();
    const liabs = Data.getLiabilities();
    const pots = Data.getPots();
    const notifs = Data.getNotifications();

    const curYm = Util.todayMonth();
    const [mStart, mEnd] = Util.monthRange(curYm);
    const monthTxs = txs.filter(t => t.time >= mStart && t.time < mEnd);
    const monthIncome = sum(monthTxs, 'income');
    const monthExpense = sum(monthTxs, 'expense');
    const monthNet = monthIncome - monthExpense;

    // 预算(本月)
    const totalBudgetObj = budgets.find(b => b.yearMonth === curYm && !b.categoryId);
    const totalBudget = totalBudgetObj ? Number(totalBudgetObj.amount || 0) : 0;
    const budgetRatio = totalBudget > 0 ? monthExpense / totalBudget : 0;
    const budgetHealth = totalBudget > 0
      ? (budgetRatio > 1 ? I18n.t('已超支') : `${Math.max(0, (100 - budgetRatio * 100)).toFixed(0)}% ${I18n.t('余量')}`)
      : '—';
    const leafExp = Data.getLeafCategories('expense');
    const catStats = leafExp.map(c => {
      const cb = budgets.find(b => b.yearMonth === curYm && b.categoryId === c.id);
      if (!cb) return null;
      const spent = monthTxs.filter(t => t.type === 'expense' && t.categoryId === c.id).reduce((s, t) => s + Number(t.amount || 0), 0);
      const r = Number(cb.amount || 0) > 0 ? spent / Number(cb.amount || 0) : 0;
      return { cat: c, budget: Number(cb.amount || 0), spent, ratio: r, over: spent > Number(cb.amount || 0) };
    }).filter(Boolean);
    const overCats = catStats.filter(c => c.over).sort((a, b) => b.ratio - a.ratio).slice(0, 3);

    const isBiz = (t) => { const c = cats.find(x => x.id === t.categoryId); return c && (c.category === 'business' || c.name === '创业收入'); };
    const bizTxs = txs.filter(isBiz);
    const bizIncome = sum(bizTxs, 'income');
    const bizExpense = sum(bizTxs, 'expense');
    const bizProfit = bizIncome - bizExpense;

    const selfInc = monthTxs.filter(t => t.type === 'income' && !(cats.find(c => c.id === t.categoryId)?.category === 'family')).reduce((s, t) => s + Number(t.amount || 0), 0);
    const selfSuff = monthExpense > 0 ? Math.min(100, selfInc / monthExpense * 100) : 0;

    const savingsRate = monthIncome > 0 ? monthNet / monthIncome * 100 : 0;
    const leverage = totals.totalAssets > 0 ? totals.totalLiabilities / totals.totalAssets * 100 : 0;
    const health = clamp(Math.round(savingsRate * 0.6 + (100 - leverage) * 0.3 + Math.min(selfSuff, 100) * 0.1), 0, 100);
    const healthColor = health >= 75 ? '#00b96b' : health >= 50 ? '#ff7d00' : '#ff4d4f';

    // 支出分类(全部)
    const expByCat = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      const c = cats.find(x => x.id === t.categoryId);
      const key = c ? c.id : 'none';
      if (!expByCat[key]) expByCat[key] = { name: byCatName(c), color: c ? c.color : '#8fc0e3', amount: 0 };
      expByCat[key].amount += Number(t.amount || 0);
    });
    const expCats = Object.values(expByCat).sort((a, b) => b.amount - a.amount);

    // 收入构成(全部)
    const incByCat = {};
    txs.filter(t => t.type === 'income').forEach(t => {
      const c = cats.find(x => x.id === t.categoryId);
      const key = c ? c.id : 'none';
      if (!incByCat[key]) incByCat[key] = { name: byCatName(c), color: c ? c.color : '#2f54eb', amount: 0 };
      incByCat[key].amount += Number(t.amount || 0);
    });
    const incCats = Object.values(incByCat).sort((a, b) => b.amount - a.amount);

    // 账户分布
    const assetAccounts = accounts.filter(a => a.type !== 'liability' && !a.archived);
    const accTotal = assetAccounts.reduce((s, a) => s + Math.max(0, Number(a.balance || 0)), 0);

    // 教育(按阶段)
    const eduArr = edu.map(e => ({ name: e.stage, total: Number(e.total || 0) })).filter(e => e.total > 0);

    // 负债
    const debtArr = liabs.map(l => ({ name: l.name, remaining: Math.abs(Number(l.remaining || 0)) })).filter(l => l.remaining > 0);

    // 高频交易对方
    const byPayee = {};
    txs.forEach(t => {
      const p = t.payee || (t.type === 'transfer' ? I18n.t('转账') : I18n.t('其他'));
      if (!byPayee[p]) byPayee[p] = { name: p, amount: 0, count: 0 };
      byPayee[p].amount += Math.abs(Number(t.amount || 0));
      byPayee[p].count++;
    });
    const topMerchants = Object.values(byPayee).sort((a, b) => b.amount - a.amount).slice(0, 8);
    const maxMerchant = topMerchants.length ? topMerchants[0].amount : 1;

    // 最近 15 笔流水
    const flowTxs = txs.slice().sort((a, b) => b.time - a.time).slice(0, 15);

    const months = getLastNMonths(txs, 12);

    view.innerHTML = `
      <div class="page-header">
        <div class="page-header-ico">${Util.icon('bar-chart')}</div>
        <div class="page-header-text">
          <h1>${I18n.t('数据中心 · 财务中枢')}</h1>
          <p>${I18n.t('预算 · 流水 · 存钱罐 · 通知 · 痕迹 一屏联动 · 共 {n} 笔交易', { n: txs.length })}</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-sm btn-ghost" onclick="Router.navigate('yearlyReport')">${Util.icon('calendar')} ${I18n.t('年度复盘')}</button>
          <button class="btn btn-sm btn-ghost" onclick="window.print()">${Util.icon('pen')} ${I18n.t('导出 / 打印')}</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card" style="--kpi-color:var(--brand)"><div class="kpi-card-label">${I18n.t('总资产')}</div><div class="kpi-card-value">${Util.fmtMoney(totals.totalAssets)}</div><div class="kpi-card-sub">${I18n.t('{n} 个账户', { n: assetAccounts.length })}</div></div>
        <div class="kpi-card" style="--kpi-color:var(--info)"><div class="kpi-card-label">${I18n.t('净资产')}</div><div class="kpi-card-value">${Util.fmtMoney(totals.netAssets)}</div><div class="kpi-card-sub">${I18n.t('资产净值')}</div></div>
        <div class="kpi-card" style="--kpi-color:var(--up)"><div class="kpi-card-label">${I18n.t('本月结余')}</div><div class="kpi-card-value">${Util.fmtMoney(monthNet)}</div><div class="kpi-card-sub">${I18n.t('收 {i} / 支 {e}', { i: Util.fmtMoneyCompact(monthIncome), e: Util.fmtMoneyCompact(monthExpense) })}</div></div>
        <div class="kpi-card" style="--kpi-color:var(--warn)"><div class="kpi-card-label">${I18n.t('储蓄率')}</div><div class="kpi-card-value">${savingsRate.toFixed(0)}%</div><div class="kpi-card-sub">${I18n.t('本月 {m} 笔', { m: monthTxs.length })}</div></div>
        <div class="kpi-card" style="--kpi-color:var(--down)"><div class="kpi-card-label">${I18n.t('总负债')}</div><div class="kpi-card-value">${Util.fmtMoney(totals.totalLiabilities)}</div><div class="kpi-card-sub">${liabs.length}${I18n.t('笔负债')}</div></div>
        <div class="kpi-card" style="--kpi-color:${budgetRatio > 1 ? 'var(--down)' : 'var(--good)'}"><div class="kpi-card-label">${I18n.t('预算健康度')}</div><div class="kpi-card-value">${budgetHealth}</div><div class="kpi-card-sub">${totalBudget > 0 ? I18n.t('总预算 {b}', { b: Util.fmtMoneyCompact(totalBudget) }) : I18n.t('未设总预算')}</div></div>
      </div>

      <div class="dc-grid">
        <div class="dc-panel">
          <h3><span class="dot"></span>${I18n.t('近 12 个月收支趋势')}</h3>
          <div class="dc-chart-box"><canvas id="dc-trend"></canvas></div>
        </div>
        <div class="dc-health-card">
          <div class="dc-health-ring-lg" style="--p:${health}; --c:${healthColor};">
            <div class="dc-health-num">${health}</div>
          </div>
          <div class="dc-health-info">
            <div class="dc-health-title">${I18n.t('财务健康分')}</div>
            <div class="dc-dims">
              <div class="dc-dim"><span class="dc-dim-label">${I18n.t('储蓄率')}</span><span class="dc-dim-bar"><span class="dc-dim-fill" style="width:${Math.min(100, Math.max(0, savingsRate))}%; background:var(--up);"></span></span><span class="dc-dim-val">${savingsRate.toFixed(0)}%</span></div>
              <div class="dc-dim"><span class="dc-dim-label">${I18n.t('负债率')}</span><span class="dc-dim-bar"><span class="dc-dim-fill" style="width:${Math.min(100, Math.max(0, leverage))}%; background:var(--down);"></span></span><span class="dc-dim-val">${leverage.toFixed(0)}%</span></div>
              <div class="dc-dim"><span class="dc-dim-label">${I18n.t('自足率')}</span><span class="dc-dim-bar"><span class="dc-dim-fill" style="width:${Math.min(100, Math.max(0, selfSuff))}%; background:var(--warn);"></span></span><span class="dc-dim-val">${selfSuff.toFixed(0)}%</span></div>
              <div class="dc-dim"><span class="dc-dim-label">${I18n.t('健康分')}</span><span class="dc-dim-bar"><span class="dc-dim-fill" style="width:${health}%; background:${healthColor};"></span></span><span class="dc-dim-val">${health}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="dc-grid-3">
        <div class="dc-panel">
          <h3><span class="dot"></span>${I18n.t('支出分类占比')}</h3>
          <div class="dc-chart-box sm"><canvas id="dc-expense-pie"></canvas></div>
        </div>
        <div class="dc-panel">
          <h3><span class="dot"></span>${I18n.t('账户资金分布')}</h3>
          <div class="dc-chart-box sm"><canvas id="dc-account-pie"></canvas></div>
        </div>
        <div class="dc-panel">
          <h3><span class="dot"></span>${I18n.t('收入构成')}</h3>
          <div class="dc-chart-box sm"><canvas id="dc-income-pie"></canvas></div>
        </div>
      </div>

      <div class="dc-budget-panel">
        <div class="dc-budget-head">
          <div class="dc-budget-title">${Util.icon('target')} ${I18n.t('本月预算总览')}</div>
          <div class="dc-budget-link"><a class="link-btn" onclick="Router.navigate('budgets')">${I18n.t('管理预算 →')}</a></div>
        </div>
        <div class="dc-budget-row">
          <div class="dc-budget-fig">
            <span class="dc-budget-spent">${Util.fmtMoney(monthExpense)}</span>
            <span class="dc-budget-sep">/</span>
            <span class="dc-budget-total">${totalBudget > 0 ? Util.fmtMoney(totalBudget) : I18n.t('未设预算')}</span>
          </div>
          <div class="dc-budget-pct" style="color:${budgetRatio > 1 ? 'var(--down)' : budgetRatio > 0.85 ? 'var(--warn)' : 'var(--good)'}">${totalBudget > 0 ? (budgetRatio * 100).toFixed(0) + '%' : '—'}</div>
        </div>
        <div class="dc-budget-bar"><span style="width:${totalBudget > 0 ? Math.min(100, budgetRatio * 100).toFixed(1) : 0}%; background:${budgetRatio > 1 ? 'var(--down)' : budgetRatio > 0.85 ? 'var(--warn)' : 'var(--good)'}"></span></div>
        <div class="dc-budget-chips">
          ${overCats.length ? overCats.map(c => `
            <span class="dc-chip danger">${Util.escapeHtml(c.cat.name)} ${I18n.t('超支')} ${(c.ratio * 100).toFixed(0)}%</span>
          `).join('') : (totalBudget > 0 ? `<span class="dc-chip ok">${I18n.t('暂无超支分类')}</span>` : `<span class="dc-chip">${I18n.t('前往「预算」设置总预算')}</span>`)}
        </div>
      </div>

      <div class="dc-grid-2">
        <div class="dc-panel dc-flow-panel">
          <h3><span class="dot"></span>${I18n.t('最近流水')} <span class="dc-sub">${I18n.t('最近 15 笔')}</span></h3>
          <div class="dc-flow-timeline">
            ${flowTxs.length ? flowTxs.map(t => {
              const c = cats.find(x => x.id === t.categoryId);
              const bc = Data.getCategoryBreadcrumb(t.categoryId, ' / ');
              const ic = c ? c.icon : 'receipt';
              return `
              <div class="dc-flow-item ${t.type}">
                <div class="dc-flow-time">${Util.fmtDate(t.time).slice(5)}</div>
                <div class="dc-flow-icon">${Util.icon(ic)}</div>
                <div class="dc-flow-main">
                  <div class="dc-flow-cat">${Util.escapeHtml(bc || byCatName(c))}</div>
                  <div class="dc-flow-payee">${Util.escapeHtml(t.payee || I18n.t('其他'))}</div>
                </div>
                <div class="dc-flow-amt ${t.type === 'income' ? 'up' : (t.type === 'expense' ? 'down' : '')}">${sign(t)}${Util.fmtMoney(t.amount)}</div>
                <button class="btn-icon dc-flow-receipt" title="${I18n.t('电子储蓄单')}" onclick="event.stopPropagation(); window.Receipt.open('${t.id}')">🧾</button>
              </div>`;
            }).join('') : `<div class="empty"><div class="empty-desc">${I18n.t('暂无交易')}</div></div>`}
          </div>
          <div class="dc-footnote"><a class="link-btn" onclick="Router.navigate('transactions')">${I18n.t('查看全部流水 →')}</a></div>
        </div>

        <div class="dc-panel dc-notif-panel">
          <h3><span class="dot"></span>${I18n.t('最新通知')}</h3>
          <div class="dc-notif-summary">
            ${notifs.length ? notifs.slice(0, 5).map(n => `
              <div class="dc-notif ${Util.escapeHtml(n.level || 'info')}">
                <div class="dc-notif-dot"></div>
                <div class="dc-notif-body">
                  <div class="dc-notif-title">${Util.escapeHtml(n.title || '')}</div>
                  ${n.body ? `<div class="dc-notif-text">${Util.escapeHtml(n.body)}</div>` : ''}
                  <div class="dc-notif-time">${Util.fmtRelativeTime(n.time)}</div>
                </div>
              </div>
            `).join('') : `<div class="empty"><div class="empty-desc">${I18n.t('暂无通知')}</div></div>`}
          </div>
          <div class="dc-footnote"><a class="link-btn" onclick="Router.navigate('notifications')">${I18n.t('前往通知中心 →')}</a></div>
        </div>
      </div>

      <div class="dc-pots-panel">
        <div class="dc-pots-head">
          <div class="dc-pots-title">${Util.icon('wallet')} ${I18n.t('存钱罐')}</div>
          <div class="dc-pots-link"><a class="link-btn" onclick="Router.navigate('pots')">${I18n.t('管理 →')}</a></div>
        </div>
        <div class="dc-pots-grid">
          ${pots.length ? pots.map(p => {
            const target = Number(p.target || 0);
            const bal = Number(p.balance || 0);
            const pct = target > 0 ? Math.min(100, bal / target * 100) : (bal > 0 ? 100 : 0);
            return `
            <div class="dc-pot">
              <div class="dc-pot-top">
                <span class="dc-pot-name">${Util.escapeHtml(p.name)}</span>
                ${target > 0 ? `<span class="dc-pot-pct">${pct.toFixed(0)}%</span>` : ''}
              </div>
              <div class="dc-pot-bal">${Util.fmtMoney(bal)}</div>
              <div class="dc-pot-bar"><span style="width:${pct.toFixed(1)}%; background:${p.color || 'var(--brand)'}"></span></div>
              ${target > 0 ? `<div class="dc-pot-target">${I18n.t('目标')} ${Util.fmtMoney(target)}</div>` : ''}
            </div>`;
          }).join('') : `<div class="dc-pot dc-pot-empty">${I18n.t('暂无存钱罐，前往「存钱罐」新增')}</div>`}
        </div>
      </div>

      <div class="dc-grid-3">
        <div class="dc-panel">
          <h3><span class="dot"></span>${I18n.t('教育投入分布 (按阶段)')}</h3>
          <div class="dc-chart-box sm"><canvas id="dc-education"></canvas></div>
        </div>
        <div class="dc-panel">
          <h3><span class="dot"></span>${I18n.t('负债结构')}</h3>
          <div class="dc-chart-box sm"><canvas id="dc-debt"></canvas></div>
        </div>
        <div class="dc-panel">
          <h3><span class="dot"></span>${I18n.t('创业月度利润')}</h3>
          <div class="dc-chart-box sm"><canvas id="dc-biz"></canvas></div>
        </div>
      </div>

      <div class="dc-grid-3">
        <div class="dc-panel">
          <h3><span class="dot"></span>${I18n.t('高频交易对方 (Top 8)')}</h3>
          <div class="dc-merchant-list">
            ${topMerchants.length ? topMerchants.map(m => `
              <div class="dc-merchant">
                <div class="dc-merchant-avatar">${Util.escapeHtml(m.name.slice(0, 1))}</div>
                <div style="flex:1; min-width:0;">
                  <div class="dc-merchant-name">${Util.escapeHtml(m.name)} <span style="color:var(--text-3); font-weight:400; font-size:11px;">· ${I18n.t('{n} 笔', { n: m.count })}</span></div>
                  <div class="dc-merchant-bar"><span style="width:${(m.amount / maxMerchant * 100).toFixed(1)}%"></span></div>
                </div>
                <div class="dc-merchant-amt">${Util.fmtMoney(m.amount)}</div>
              </div>
            `).join('') : `<div class="empty"><div class="empty-desc">${I18n.t('暂无数据')}</div></div>`}
          </div>
          <div class="dc-footnote">${I18n.t('数据范围: 全部 {n} 笔交易 · 截至 {d}', { n: txs.length, d: Util.fmtDate(Date.now()) })}</div>
        </div>
        <div class="dc-hub-nav" style="grid-column: span 2;">
          <a class="dc-hub-card" onclick="Router.navigate('transactions')">
            <div class="dc-hub-ico">${Util.icon('receipt')}</div>
            <div><div class="dc-hub-t">${I18n.t('交易流水')}</div><div class="dc-hub-s">${I18n.t('逐笔追溯 · 电子储蓄单')}</div></div>
          </a>
          <a class="dc-hub-card" onclick="Router.navigate('yearlyReport')">
            <div class="dc-hub-ico">${Util.icon('calendar')}</div>
            <div><div class="dc-hub-t">${I18n.t('年度复盘')}</div><div class="dc-hub-s">${I18n.t('12 月趋势 · 分类排行')}</div></div>
          </a>
          <a class="dc-hub-card" onclick="Router.navigate('notifications')">
            <div class="dc-hub-ico">${Util.icon('bell')}</div>
            <div><div class="dc-hub-t">${I18n.t('通知中心')}</div><div class="dc-hub-s">${I18n.t('预算 · 还款 · 同步 提醒')}</div></div>
          </a>
          <a class="dc-hub-card" onclick="Router.navigate('audit')">
            <div class="dc-hub-ico">${Util.icon('shield-check')}</div>
            <div><div class="dc-hub-t">${I18n.t('痕迹日志')}</div><div class="dc-hub-s">${I18n.t('全部操作留痕可查')}</div></div>
          </a>
        </div>
      </div>
    `;

    renderTrend(months);
    renderExpensePie(expCats);
    renderAccountPie(assetAccounts, accTotal);
    renderIncomePie(incCats);
    renderEducation(eduArr);
    renderDebt(debtArr);
    renderBiz(getLastNMonths(bizTxs, 12));
  }

  function renderTrend(months) {
    const ctx = document.getElementById('dc-trend'); if (!ctx) return;
    const ct = Util.chartTheme();
    charts.trend = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months.map(m => m.ym.slice(2).replace('-', '/')),
        datasets: [
          { label: I18n.t('收入'), data: months.map(m => m.income), backgroundColor: 'rgba(0,185,107,.75)', borderRadius: 4 },
          { label: I18n.t('支出'), data: months.map(m => m.expense), backgroundColor: 'rgba(255,77,79,.70)', borderRadius: 4 },
          { label: I18n.t('结余'), data: months.map(m => m.income - m.expense), type: 'line', borderColor: '#ff4d4f', backgroundColor: 'rgba(255,77,79,.08)', fill: false, tension: .3, pointRadius: 3, pointBackgroundColor: '#ff4d4f' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: ct.text } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: ct.tick, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: { grid: { color: ct.grid }, ticks: { color: ct.tick, callback: (v) => '¥' + Number(v).toLocaleString('zh-CN') } },
        },
      },
    });
  }

  function renderExpensePie(expCats) {
    const ctx = document.getElementById('dc-expense-pie'); if (!ctx) return;
    const ct = Util.chartTheme();
    if (!expCats.length) { ctx.parentElement.innerHTML = `<div class="empty"><div class="empty-desc">${I18n.t('暂无支出')}</div></div>`; return; }
    charts.expense = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: expCats.map(c => c.name), datasets: [{ data: expCats.map(c => c.amount), backgroundColor: expCats.map(c => c.color), borderWidth: 2, borderColor: '#ffffff' }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { color: ct.text, font: { size: 11 }, boxWidth: 12 } }, title: { display: true, text: `${I18n.t('合计')} ${Util.fmtMoneyCompact(expCats.reduce((s, c) => s + c.amount, 0))}`, color: ct.title, font: { size: 12 } } } },
    });
  }

  function renderIncomePie(incCats) {
    const ctx = document.getElementById('dc-income-pie'); if (!ctx) return;
    const ct = Util.chartTheme();
    if (!incCats.length) { ctx.parentElement.innerHTML = `<div class="empty"><div class="empty-desc">${I18n.t('暂无收入')}</div></div>`; return; }
    charts.income = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: incCats.map(c => c.name), datasets: [{ data: incCats.map(c => c.amount), backgroundColor: incCats.map(c => c.color), borderWidth: 2, borderColor: '#ffffff' }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { color: ct.text, font: { size: 11 }, boxWidth: 12 } }, title: { display: true, text: `${I18n.t('合计')} ${Util.fmtMoneyCompact(incCats.reduce((s, c) => s + c.amount, 0))}`, color: ct.title, font: { size: 12 } } } },
    });
  }

  function renderAccountPie(accounts, total) {
    const ctx = document.getElementById('dc-account-pie'); if (!ctx) return;
    const ct = Util.chartTheme();
    const data = accounts.map(a => ({ name: a.name, balance: Math.max(0, Number(a.balance || 0)), color: a.color || '#C7000B' }));
    if (!data.length || total <= 0) { ctx.parentElement.innerHTML = `<div class="empty"><div class="empty-desc">${I18n.t('暂无账户余额')}</div></div>`; return; }
    charts.account = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: data.map(d => d.name), datasets: [{ data: data.map(d => d.balance), backgroundColor: data.map(d => d.color), borderWidth: 2, borderColor: '#ffffff' }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { color: ct.text, font: { size: 11 }, boxWidth: 12 } }, title: { display: true, text: `${I18n.t('合计')} ${Util.fmtMoneyCompact(total)}`, color: ct.title, font: { size: 12 } } } },
    });
  }

  function renderEducation(eduArr) {
    const ctx = document.getElementById('dc-education'); if (!ctx) return;
    const ct = Util.chartTheme();
    if (!eduArr.length) { ctx.parentElement.innerHTML = `<div class="empty"><div class="empty-desc">${I18n.t('暂无教育阶段')}</div></div>`; return; }
    charts.edu = new Chart(ctx, {
      type: 'bar',
      data: { labels: eduArr.map(e => e.name.length > 10 ? e.name.slice(0, 10) + '…' : e.name), datasets: [{ label: I18n.t('累计投入'), data: eduArr.map(e => e.total), backgroundColor: 'rgba(0,185,107,.75)', borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: ct.grid }, ticks: { color: ct.tick, callback: (v) => '¥' + Number(v).toLocaleString('zh-CN') } }, y: { grid: { display: false }, ticks: { color: ct.tick, font: { size: 11 } } } } },
    });
  }

  function renderDebt(debtArr) {
    const ctx = document.getElementById('dc-debt'); if (!ctx) return;
    const ct = Util.chartTheme();
    if (!debtArr.length) { ctx.parentElement.innerHTML = `<div class="empty"><div class="empty-desc">${I18n.t('暂无负债')}</div></div>`; return; }
    charts.debt = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: debtArr.map(d => d.name), datasets: [{ data: debtArr.map(d => d.remaining), backgroundColor: ['#6E0006', '#C7000B', '#FF4D4F', '#ff7d00', '#8E0007', '#f5b5b8'], borderWidth: 2, borderColor: '#ffffff' }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { color: ct.text, font: { size: 11 }, boxWidth: 12 } }, title: { display: true, text: `${I18n.t('合计')} ${Util.fmtMoneyCompact(debtArr.reduce((s, d) => s + d.remaining, 0))}`, color: ct.title, font: { size: 12 } } } },
    });
  }

  function renderBiz(months) {
    const ctx = document.getElementById('dc-biz'); if (!ctx) return;
    const ct = Util.chartTheme();
    charts.biz = new Chart(ctx, {
      type: 'bar',
      data: { labels: months.map(m => m.ym.slice(2).replace('-', '/')), datasets: [{ label: I18n.t('利润'), data: months.map(m => m.income - m.expense), backgroundColor: months.map(m => (m.income - m.expense) >= 0 ? 'rgba(0,185,107,.8)' : 'rgba(255,77,79,.7)'), borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: ct.tick, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }, y: { grid: { color: ct.grid }, ticks: { color: ct.tick, callback: (v) => '¥' + Number(v).toLocaleString('zh-CN') } } } },
    });
  }

  return { render };
})();
