/* =========================================================
   View: 创业看板 (利润独立核算)
   ========================================================= */

const EntrepreneurshipView = (() => {

  function render(view) {
    const txs = Data.getTransactions();
    const cats = Data.getCategories();
    const isBiz = (t) => {
      const cat = cats.find(c => c.id === t.categoryId);
      return cat && (cat.category === 'business' || cat.name === '创业收入');
    };
    const bizTxs = txs.filter(isBiz);

    const totalIncome = bizTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = bizTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalProfit = totalIncome - totalExpense;
    const margin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;

    // 本月
    const ym = Util.todayMonth();
    const [start, end] = Util.monthRange(ym);
    const monthBiz = bizTxs.filter(t => t.time >= start && t.time < end);
    const monthIncome = monthBiz.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const monthExpense = monthBiz.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const monthProfit = monthIncome - monthExpense;

    // 成本结构
    const costByCat = {};
    bizTxs.filter(t => t.type === 'expense').forEach(t => {
      const cat = cats.find(c => c.id === t.categoryId);
      const key = cat ? cat.id : 'none';
      if (!costByCat[key]) costByCat[key] = { cat, name: cat ? cat.name : I18n.t('未分类'), amount: 0, color: cat ? cat.color : '#8fc0e3' };
      costByCat[key].amount += t.amount;
    });
    const costArr = Object.values(costByCat).sort((a, b) => b.amount - a.amount);

    // 月度利润趋势
    const months = getBizMonths(bizTxs);

    view.innerHTML = `
      <div class="kpi-row">
        <div class="kpi-cell"><div class="kpi-label">${I18n.t('累计创业收入')}</div><div class="kpi-value" style="color:var(--up)">${Util.fmtMoney(totalIncome)}</div></div>
        <div class="kpi-cell"><div class="kpi-label">${I18n.t('累计创业成本')}</div><div class="kpi-value" style="color:var(--down)">${Util.fmtMoney(totalExpense)}</div></div>
        <div class="kpi-cell"><div class="kpi-label">${I18n.t('累计净利润')}</div><div class="kpi-value" style="color:var(--warn)">${Util.fmtMoney(totalProfit)}</div></div>
        <div class="kpi-cell"><div class="kpi-label">${I18n.t('平均利润率')}</div><div class="kpi-value">${margin.toFixed(1)}%</div></div>
      </div>

      <div class="dash-row">
        <div class="card">
          <div class="card-title">
            <div class="card-title-text">
              ${Util.icon('line-chart','card-title-icon')}
              ${I18n.t('利润趋势 (月度)')}
            </div>
          </div>
          <div style="height:300px; position:relative;"><canvas id="biz-profit-chart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title"><div class="card-title-text">${Util.icon('pie','card-title-icon')} ${I18n.t('成本结构')}</div></div>
          <div style="height:300px; position:relative;"><canvas id="biz-cost-pie"></canvas></div>
        </div>
      </div>

      <div class="dash-row">
        <div class="card">
          <div class="card-title"><div class="card-title-text">${Util.icon('calendar','card-title-icon')} ${Util.monthLabel(ym)} ${I18n.t('经营概况')}</div></div>
          <div style="display:grid; gap:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-3); border-radius:var(--r-md);">
              <span style="color:var(--text-muted);">${I18n.t('本月收入')}</span><span style="font-weight:700; color:var(--up);">${Util.fmtMoney(monthIncome)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-3); border-radius:var(--r-md);">
              <span style="color:var(--text-muted);">${I18n.t('本月成本')}</span><span style="font-weight:700; color:var(--down);">${Util.fmtMoney(monthExpense)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-3); border-radius:var(--r-md);">
              <span style="color:var(--text-muted);">${I18n.t('本月净利润')}</span><span style="font-weight:700; color:var(--warn);">${Util.fmtMoney(monthProfit)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-3); border-radius:var(--r-md);">
              <span style="color:var(--text-muted);">${I18n.t('交易笔数')}</span><span style="font-weight:700;">${monthBiz.length}</span>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-title"><div class="card-title-text">${Util.icon('bar-chart', 'card-title-icon')} ${I18n.t('成本排行')}</div></div>
          ${costArr.length ? `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${costArr.slice(0, 6).map(c => {
                const r = c.amount / Math.max(1, costArr[0].amount);
                return `
                  <div>
                    <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
                      <span>${c.cat ? Util.icon(Util.categoryIcon(c.cat)) : ''} ${Util.escapeHtml(c.name)}</span>
                      <span style="font-weight:600;">${Util.fmtMoney(c.amount)}</span>
                    </div>
                    <div class="gauge-bar"><div class="gauge-fill" style="width:${Math.max(4, r * 100)}%; background:${c.color};"></div></div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `<div class="empty"><div class="empty-desc">${I18n.t('暂无创业成本')}</div></div>`}
        </div>
      </div>
    `;

    renderProfitChart(months);
    renderCostPie(costArr, totalExpense);
  }

  function getBizMonths(bizTxs) {
    const months = {};
    bizTxs.forEach(t => {
      const ym = Util.fmtMonth(t.time);
      if (!months[ym]) months[ym] = { income: 0, expense: 0 };
      if (t.type === 'income') months[ym].income += t.amount;
      else if (t.type === 'expense') months[ym].expense += t.amount;
    });
    return Object.entries(months).sort((a, b) => a[0].localeCompare(b[0])).map(([ym, v]) => ({
      ym,
      income: v.income,
      expense: v.expense,
      profit: v.income - v.expense,
    }));
  }

  let profitChart = null, costPie = null;
  function renderProfitChart(months) {
    const ctx = document.getElementById('biz-profit-chart');
    if (!ctx) return;
    if (profitChart) profitChart.destroy();
    const ct = Util.chartTheme();
    profitChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months.map(m => m.ym.replace('-', '/') + '/01'),
        datasets: [
          { label: I18n.t('收入'), data: months.map(m => m.income), backgroundColor: 'rgba(29,78,216,.7)', borderRadius: 4 },
          { label: I18n.t('成本'), data: months.map(m => -m.expense), backgroundColor: 'rgba(96,165,250,.7)', borderRadius: 4 },
          { label: I18n.t('利润'), data: months.map(m => m.profit), type: 'line', borderColor: '#5b9bd5', backgroundColor: 'rgba(96,165,250,.1)', fill: false, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#5b9bd5' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: ct.text } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: ct.tick, font: { size: 10 } } },
          y: { grid: { color: ct.grid }, ticks: { color: ct.tick, callback: (v) => '¥' + Math.abs(v).toLocaleString('zh-CN') } },
        },
      },
    });
  }

  function renderCostPie(costArr, total) {
    const ctx = document.getElementById('biz-cost-pie');
    if (!ctx) return;
    if (costPie) costPie.destroy();
    const ct = Util.chartTheme();
    if (!costArr.length) { ctx.parentElement.innerHTML = `<div class="empty"><div class="empty-desc">${I18n.t('暂无成本数据')}</div></div>`; return; }
    costPie = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: costArr.map(c => c.name),
        datasets: [{ data: costArr.map(c => c.amount), backgroundColor: costArr.map(c => c.color), borderWidth: 2, borderColor: '#ffffff' }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: ct.text, font: { size: 11 }, boxWidth: 12 } },
          title: { display: true, text: `${I18n.t('合计')} ${Util.fmtMoneyCompact(total)}`, color: ct.title, font: { size: 12 } },
        },
      },
    });
  }

  return { render };
})();
