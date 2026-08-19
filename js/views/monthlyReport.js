/* =========================================================
   View: 月度复盘报告 (自动生成) — 图表增强版
   ========================================================= */

const MonthlyReportView = (() => {

  let curYm = Util.todayMonth();

  function render(view, params) {
    if (params && params.month) curYm = params.month;

    const ym = curYm;
    const [start, end] = Util.monthRange(ym);
    const prevYm = prevMonth(ym);
    const [pStart, pEnd] = Util.monthRange(prevYm);

    const txs = Data.getTransactions();
    const monthTxs = txs.filter(t => t.time >= start && t.time < end);
    const prevTxs = txs.filter(t => t.time >= pStart && t.time < pEnd);

    const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const prevIncome = prevTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const prevExpense = prevTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const net = income - expense;
    const prevNet = prevIncome - prevExpense;

    const incomeGrowth = calcGrowth(income, prevIncome);
    const expenseGrowth = calcGrowth(expense, prevExpense);

    const parentsIncome = monthTxs.filter(t => {
      const cat = Data.getCategories().find(c => c.id === t.categoryId);
      return t.type === 'income' && (cat && cat.category === 'family');
    }).reduce((s, t) => s + t.amount, 0);
    const selfIncome = income - parentsIncome;
    const selfSufficiency = expense > 0 ? Math.min(100, (selfIncome / expense) * 100) : 0;

    const incomeByCat = groupByCategory(monthTxs.filter(t => t.type === 'income'));
    const expenseByCat = groupByCategory(monthTxs.filter(t => t.type === 'expense'));

    const bizTxs = monthTxs.filter(t => {
      const cat = Data.getCategories().find(c => c.id === t.categoryId);
      return cat && (cat.category === 'business' || cat.name === '创业收入');
    });
    const bizIncome = bizTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const bizExpense = bizTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const bizProfit = bizIncome - bizExpense;
    const bizMargin = bizIncome > 0 ? (bizProfit / bizIncome) * 100 : 0;

    const eduTxs = monthTxs.filter(t => {
      const cat = Data.getCategories().find(c => c.id === t.categoryId);
      return cat && cat.category === 'education';
    });
    const eduExpense = eduTxs.reduce((s, t) => s + t.amount, 0);

    const dayData = buildDailyTrend(monthTxs, start, end);
    const calendar = buildCalendarHeatmap(monthTxs, start, end);
    const flowTxs = monthTxs.slice().sort((a, b) => b.time - a.time);

    const monthNames = getAvailableMonths();

    view.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <select class="input" id="mr-month" style="width:180px;">
            ${monthNames.map(m => `<option value="${m}" ${m === ym ? 'selected' : ''}>${Util.monthLabel(m)}</option>`).join('')}
          </select>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-ghost btn-sm" onclick="window.__printReport()">${I18n.t('打印')}</button>
          <button class="btn btn-primary btn-sm" onclick="window.__exportReport()">${Util.icon('download')} ${I18n.t('导出报告')}</button>
        </div>
      </div>

      <div class="card" style="background:var(--brand-soft); border-color:rgba(199,0,11,.18);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
          <div>
            <div style="font-size:13px; color:var(--text-muted);">${Util.monthLabel(ym)} · ${I18n.t('财务复盘')}</div>
            <div style="font-size:36px; font-weight:800; margin-top:6px; font-family:'JetBrains Mono',monospace; color:${net>=0?'var(--good)':'var(--down)'};">
              ${net >= 0 ? '+' : '-'}${Util.fmtMoney(Math.abs(net))}
            </div>
            <div style="color:var(--text-muted); font-size:13px; margin-top:4px;">${I18n.t('本月净结余')}</div>
          </div>
          <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:12px; min-width:320px;">
            <div class="kpi-cell" style="background:rgba(255,255,255,.6);">
              <div class="kpi-label">${I18n.t('收入')}</div>
              <div class="kpi-value" style="color:var(--up); font-size:18px;">${Util.fmtMoneyCompact(income)}</div>
              <div style="font-size:11px;">${growthText(incomeGrowth)}</div>
            </div>
            <div class="kpi-cell" style="background:rgba(255,255,255,.6);">
              <div class="kpi-label">${I18n.t('支出')}</div>
              <div class="kpi-value" style="color:var(--down); font-size:18px;">${Util.fmtMoneyCompact(expense)}</div>
              <div style="font-size:11px;">${growthText(expenseGrowth)}</div>
            </div>
            <div class="kpi-cell" style="background:rgba(255,255,255,.6);">
              <div class="kpi-label">${I18n.t('储蓄率')}</div>
              <div class="kpi-value" style="font-size:18px;">${income>0?(net/income*100).toFixed(0):0}%</div>
            </div>
            <div class="kpi-cell" style="background:rgba(255,255,255,.6);">
              <div class="kpi-label">${I18n.t('创业利润')}</div>
              <div class="kpi-value" style="color:var(--warn); font-size:18px;">${Util.fmtMoneyCompact(bizProfit)}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="dash-row">
        <div class="card">
          <div class="card-title"><div class="card-title-text">${Util.icon('line-chart','card-title-icon')} ${I18n.t('每日收支趋势')}</div></div>
          <div style="height:260px; position:relative;"><canvas id="mr-trend"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title"><div class="card-title-text">${I18n.t('累计结余曲线')}</div></div>
          <div style="height:260px; position:relative;"><canvas id="mr-balance"></canvas></div>
        </div>
      </div>

      <div class="dash-row">
        <div class="card">
          <div class="card-title"><div class="card-title-text">${I18n.t('收入构成')}</div></div>
          <div style="height:260px; position:relative;"><canvas id="mr-income-pie"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title"><div class="card-title-text">${I18n.t('支出分类占比')}</div></div>
          <div style="height:260px; position:relative;"><canvas id="mr-expense-pie"></canvas></div>
        </div>
      </div>

      <div class="dash-row">
        <div class="card">
          <div class="card-title"><div class="card-title-text">${Util.icon('calendar','card-title-icon')} ${I18n.t('每日支出热力图')}</div></div>
          <div class="mr-calendar">
            <div class="mr-cal-week">${['日','一','二','三','四','五','六'].map(d=>`<span>${d}</span>`).join('')}</div>
            <div class="mr-cal-grid">
              ${calendar.cells.map(c => c.empty ? `<div class="mr-cal-cell empty"></div>` : `
                <div class="mr-cal-cell" style="background:${c.bg};" title="${c.day} ${I18n.t('支出')} ${Util.fmtMoney(c.amount)}">
                  <span class="mr-cal-day">${c.day}</span>
                  <span class="mr-cal-amt">${c.amount>0?Util.fmtMoneyCompact(c.amount):''}</span>
                </div>
              `).join('')}
            </div>
            <div class="mr-cal-legend">
              <span>${I18n.t('少')}</span>
              <span class="mr-cal-dot" style="background:var(--brand-soft)"></span>
              <span class="mr-cal-dot" style="background:rgba(199,0,11,.4)"></span>
              <span class="mr-cal-dot" style="background:rgba(199,0,11,.7)"></span>
              <span class="mr-cal-dot" style="background:var(--brand)"></span>
              <span>${I18n.t('多')}</span>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-title"><div class="card-title-text">${I18n.t('支出排行 (按分类)')}</div></div>
          ${expenseByCat.length ? `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${expenseByCat.slice(0, 8).map(c => {
                const r = c.amount / Math.max(1, expenseByCat[0].amount);
                return `
                  <div>
                    <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
                      <span>${c.cat && c.cat.icon ? c.cat.icon : ''} ${Util.escapeHtml(c.catName)}</span>
                      <span style="font-weight:600;">${Util.fmtMoney(c.amount)} <span style="color:var(--text-muted); font-weight:400;">(${((c.amount / Math.max(1, expense)) * 100).toFixed(1)}%)</span></span>
                    </div>
                    <div class="gauge-bar"><div class="gauge-fill" style="width:${Math.max(4, r * 100)}%; background:${c.cat ? c.cat.color : 'var(--brand)'};"></div></div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `<div class="empty"><div class="empty-desc">${I18n.t('本月暂无支出')}</div></div>`}
        </div>
      </div>

      <div class="dash-row">
        <div class="card">
          <div class="card-title"><div class="card-title-text">${Util.icon('receipt','card-title-icon')} ${I18n.t('本月发票明细')} <span style="color:var(--text-muted); font-weight:400; font-size:12px;">· ${I18n.t('{n} 笔', { n: flowTxs.length })}</span></div></div>
          <div class="inv-scroll">${buildInvoiceTable(flowTxs)}</div>
        </div>
        <div class="card">
          <div class="card-title"><div class="card-title-text">${Util.icon('briefcase', 'card-title-icon')} ${I18n.t('创业小结')}</div></div>
          <div style="display:grid; gap:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-3); border-radius:var(--r-sm);">
              <span style="color:var(--text-muted);">${I18n.t('创业收入')}</span>
              <span style="font-weight:700; color:var(--up);">${Util.fmtMoney(bizIncome)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-3); border-radius:var(--r-sm);">
              <span style="color:var(--text-muted);">${I18n.t('创业成本')}</span>
              <span style="font-weight:700; color:var(--down);">${Util.fmtMoney(bizExpense)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-3); border-radius:var(--r-sm);">
              <span style="color:var(--text-muted);">${I18n.t('净利润')}</span>
              <span style="font-weight:700; color:var(--warn);">${Util.fmtMoney(bizProfit)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-3); border-radius:var(--r-sm);">
              <span style="color:var(--text-muted);">${I18n.t('利润率')}</span>
              <span style="font-weight:700;">${bizMargin.toFixed(1)}%</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); padding:8px; background:var(--bg-3); border-radius:var(--r-sm);">
              ${bizProfit > 0 ? I18n.t('本月创业实现盈利,继续保持!') : bizProfit < 0 ? I18n.t('本月创业亏损,建议分析成本结构。') : I18n.t('本月暂无创业活动。')}
            </div>
          </div>
        </div>
      </div>

      <div class="dash-row">
        <div class="card">
          <div class="card-title"><div class="card-title-text">${Util.icon('graduation', 'card-title-icon')} ${I18n.t('教育统计')}</div></div>
          <div style="display:grid; gap:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-3); border-radius:var(--r-sm);">
              <span style="color:var(--text-muted);">${I18n.t('本月教育支出')}</span>
              <span style="font-weight:700;">${Util.fmtMoney(eduExpense)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-3); border-radius:var(--r-sm);">
              <span style="color:var(--text-muted);">${I18n.t('教育累计(各阶段)')}</span>
              <span style="font-weight:700;">${Util.fmtMoneyCompact(Data.getEducationStages().reduce((s, e) => s + (e.total || 0), 0))}</span>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-title"><div class="card-title-text">${Util.icon('bar-chart', 'card-title-icon')} ${I18n.t('关键指标')}</div></div>
          <div style="display:grid; gap:10px;">
            <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text-muted);">${I18n.t('交易笔数')}</span><span style="font-weight:700;">${monthTxs.length}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text-muted);">${I18n.t('日均支出')}</span><span style="font-weight:700;">${Util.fmtMoney(expense / Math.max(1, dayData.days))}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text-muted);">${I18n.t('最大单笔支出')}</span><span style="font-weight:700;">${Util.fmtMoney(Math.max(0, ...monthTxs.filter(t=>t.type==='expense').map(t=>t.amount)))}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text-muted);">${I18n.t('储蓄率')}</span><span style="font-weight:700; color:var(--good);">${(income>0 ? (net/income*100) : 0).toFixed(1)}%</span></div>
          </div>
        </div>
      </div>

      <div class="dash-row">
        <div class="card" style="grid-column:1/-1;">
          <div class="card-title"><div class="card-title-text">${Util.icon('bar-chart','card-title-icon')} ${I18n.t('各账户发票明细')} <span style="color:var(--text-muted); font-weight:400; font-size:12px;">· ${Util.monthLabel(ym)}</span></div></div>
          ${buildAccountInvoices(monthTxs)}
        </div>
      </div>

    `;

    bindEvents();
    renderTrendChart(dayData);
    renderBalanceChart(dayData);
    renderIncomePie(incomeByCat, income);
    renderExpensePie(expenseByCat, expense);
  }

  const TLABEL = { income: I18n.t('收入'), expense: I18n.t('支出'), transfer: I18n.t('转账') };

  function buildInvoiceTable(txs) {
    if (!txs || !txs.length) return `<div class="data-table-empty">${I18n.t('本月暂无交易')}</div>`;
    const rows = txs.slice().sort((a, b) => b.time - a.time).map(t => {
      const bc = Data.getCategoryBreadcrumb(t.categoryId, ' / ');
      const c = Data.getCategories().find(x => x.id === t.categoryId);
      const acc = Data.getAccount(t.accountId);
      const toAcc = t.toAccountId ? Data.getAccount(t.toAccountId) : null;
      const typeLabel = TLABEL[t.type] || t.type;
      const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '';
      const amtCls = t.type === 'income' ? 'amt-pos' : t.type === 'expense' ? 'amt-neg' : '';
      const accStr = Util.escapeHtml(acc ? acc.name : '—') + (toAcc ? ' → ' + Util.escapeHtml(toAcc.name) : '');
      return `<tr>
        <td>${Util.fmtDate(t.time).slice(5)}</td>
        <td><span class="cell-tag ${t.type}">${typeLabel}</span></td>
        <td class="cell-cat">${Util.escapeHtml(bc || (c ? c.name : I18n.t('未分类')))}</td>
        <td>${accStr}</td>
        <td class="cell-payee">${Util.escapeHtml(t.payee || I18n.t('其他'))}</td>
        <td class="num ${amtCls}">${sign}${Util.fmtMoney(t.amount)}</td>
        <td class="num"><button class="row-btn" title="${I18n.t('电子储蓄单')}" onclick="event.stopPropagation(); window.Receipt.open('${t.id}')">🧾</button></td>
      </tr>`;
    }).join('');
    return `<table class="data-table">
      <thead><tr>
        <th>${I18n.t('日期')}</th><th>${I18n.t('类型')}</th><th>${I18n.t('分类')}</th><th>${I18n.t('账户')}</th><th>${I18n.t('对方')}</th><th class="num">${I18n.t('金额')}</th><th class="num"></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function buildAccountInvoices(monthTxs) {
    const accounts = Data.getAccounts();
    if (!accounts || !accounts.length) return `<div class="data-table-empty">${I18n.t('暂无账户')}</div>`;
    let html = '';
    accounts.forEach(a => {
      const aTxs = monthTxs.filter(t => t.accountId === a.id || t.toAccountId === a.id);
      if (!aTxs.length) return;
      let inc = 0, exp = 0;
      aTxs.forEach(t => {
        if (t.type === 'income' && t.accountId === a.id) inc += t.amount;
        else if (t.type === 'transfer' && t.toAccountId === a.id) inc += t.amount;
        else if (t.type === 'expense' && t.accountId === a.id) exp += t.amount;
        else if (t.type === 'transfer' && t.accountId === a.id) exp += t.amount;
      });
      const net = inc - exp;
      const dot = a.color ? `<span class="dot" style="background:${a.color}"></span>` : '';
      html += `<div class="acct-inv">
        <div class="acct-inv-head">
          <div class="acct-inv-name">${dot}${Util.escapeHtml(a.name)}</div>
          <div class="acct-inv-sum">
            <span class="s-income">收入 <b>${Util.fmtMoney(inc)}</b></span>
            <span class="s-expense">支出 <b>${Util.fmtMoney(exp)}</b></span>
            <span class="s-net">结余 <b>${Util.fmtMoney(net)}</b></span>
            <span>笔数 <b>${aTxs.length}</b></span>
          </div>
        </div>
        ${buildInvoiceTable(aTxs)}
      </div>`;
    });
    return html || `<div class="data-table-empty">${I18n.t('本月暂无交易')}</div>`;
  }

  function bindEvents() {
    const sel = document.getElementById('mr-month');
    if (sel) sel.addEventListener('change', (e) => {
      curYm = e.target.value;
      render(document.getElementById('view'));
    });
  }

  function getAvailableMonths() {
    const txs = Data.getTransactions();
    const months = new Set();
    months.add(Util.todayMonth());
    txs.forEach(t => months.add(Util.fmtMonth(t.time)));
    return Array.from(months).sort().reverse();
  }

  function groupByCategory(txs) {
    const categories = Data.getCategories();
    const map = {};
    txs.forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      const key = cat ? cat.id : 'none';
      if (!map[key]) map[key] = { cat, catName: cat ? cat.name : I18n.t('未分类'), amount: 0, color: cat ? cat.color : '#8fc0e3' };
      map[key].amount += t.amount;
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }

  function buildDailyTrend(txs, start, end) {
    const days = Math.round((end - start) / 86400_000);
    const labels = [], income = [], expense = [], net = [];
    let cum = 0;
    for (let i = 0; i < days; i++) {
      const dStart = start + i * 86400_000;
      const dEnd = dStart + 86400_000;
      const dTxs = txs.filter(t => t.time >= dStart && t.time < dEnd);
      const inc = dTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const exp = dTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      income.push(inc); expense.push(exp);
      cum += inc - exp; net.push(cum);
      const d = new Date(dStart);
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    }
    return { labels, income, expense, net, days };
  }

  function buildCalendarHeatmap(txs, start, end) {
    const days = Math.round((end - start) / 86400_000);
    const first = new Date(start);
    const lead = first.getDay(); // 0=Sun
    const expByDay = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      const d = Math.floor((t.time - start) / 86400_000);
      if (d >= 0 && d < days) expByDay[d] = (expByDay[d] || 0) + t.amount;
    });
    const maxExp = Math.max(1, ...Object.values(expByDay));
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push({ empty: true });
    for (let d = 0; d < days; d++) {
      const amt = expByDay[d] || 0;
      const ratio = amt / maxExp;
      let bg = 'transparent';
      if (amt > 0) bg = ratio > 0.75 ? 'var(--brand)' : ratio > 0.5 ? 'rgba(199,0,11,.7)' : ratio > 0.25 ? 'rgba(199,0,11,.4)' : 'var(--brand-soft)';
      cells.push({ empty: false, day: d + 1, amount: amt, bg });
    }
    while (cells.length % 7 !== 0) cells.push({ empty: true });
    return { cells };
  }

  let trendChart = null, pieChart = null, expensePie = null, balanceChart = null;
  function renderTrendChart(dayData) {
    const ctx = document.getElementById('mr-trend');
    if (!ctx) return;
    if (trendChart) trendChart.destroy();
    const ct = Util.chartTheme();
    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dayData.labels,
        datasets: [
          { label: I18n.t('收入'), data: dayData.income, borderColor: '#00b96b', backgroundColor: 'rgba(0,185,107,.1)', fill: true, tension: 0.3, pointRadius: 0 },
          { label: I18n.t('支出'), data: dayData.expense, borderColor: '#ff4d4f', backgroundColor: 'rgba(255,77,79,.1)', fill: true, tension: 0.3, pointRadius: 0 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: ct.text } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: ct.tick, maxTicksLimit: 10, font: { size: 10 } } },
          y: { grid: { color: ct.grid }, ticks: { color: ct.tick, callback: (v) => '¥' + v.toLocaleString('zh-CN') } },
        },
      },
    });
  }

  function renderBalanceChart(dayData) {
    const ctx = document.getElementById('mr-balance');
    if (!ctx) return;
    if (balanceChart) balanceChart.destroy();
    const ct = Util.chartTheme();
    balanceChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dayData.labels,
        datasets: [{
          label: I18n.t('累计结余'), data: dayData.net,
          borderColor: '#C7000B', backgroundColor: 'rgba(199,0,11,.10)', fill: true, tension: 0.3, pointRadius: 0,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: ct.tick, maxTicksLimit: 10, font: { size: 10 } } },
          y: { grid: { color: ct.grid }, ticks: { color: ct.tick, callback: (v) => '¥' + v.toLocaleString('zh-CN') } },
        },
      },
    });
  }

  function renderIncomePie(incomeByCat, total) {
    const ctx = document.getElementById('mr-income-pie');
    if (!ctx) return;
    if (pieChart) pieChart.destroy();
    const ct = Util.chartTheme();
    if (!incomeByCat.length) {
      ctx.parentElement.innerHTML = `<div class="empty"><div class="empty-desc">${I18n.t('本月暂无收入')}</div></div>`;
      return;
    }
    pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: incomeByCat.map(c => c.catName),
        datasets: [{ data: incomeByCat.map(c => c.amount), backgroundColor: incomeByCat.map(c => c.color), borderWidth: 2, borderColor: '#ffffff' }],
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

  function renderExpensePie(expenseByCat, total) {
    const ctx = document.getElementById('mr-expense-pie');
    if (!ctx) return;
    if (expensePie) expensePie.destroy();
    const ct = Util.chartTheme();
    if (!expenseByCat.length) {
      ctx.parentElement.innerHTML = `<div class="empty"><div class="empty-desc">${I18n.t('本月暂无支出')}</div></div>`;
      return;
    }
    expensePie = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: expenseByCat.map(c => c.catName),
        datasets: [{ data: expenseByCat.map(c => c.amount), backgroundColor: expenseByCat.map(c => c.color), borderWidth: 2, borderColor: '#ffffff' }],
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

  function calcGrowth(cur, prev) {
    if (!prev) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  }
  function growthText(g) {
    if (g === 0) return `<span style="color:var(--text-muted)">${I18n.t('持平')}</span>`;
    const cls = g > 0 ? 'var(--up)' : 'var(--down)';
    return `<span style="color:${cls}; display:inline-flex; align-items:center; gap:3px;">${Util.icon(g > 0 ? 'arrow-up' : 'arrow-down')} ${Math.abs(g).toFixed(1)}% ${I18n.t('环比')}</span>`;
  }

  function prevMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    if (m === 1) return `${y - 1}-12`;
    return `${y}-${String(m - 1).padStart(2, '0')}`;
  }

  window.__exportReport = () => {
    const ym = curYm;
    const [start, end] = Util.monthRange(ym);
    const txs = Data.getTransactions().filter(t => t.time >= start && t.time < end);
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = income - expense;
    const tlabel = { income: I18n.t('收入'), expense: I18n.t('支出'), transfer: I18n.t('转账') };
    const lines = [];
    lines.push(`# ${Util.monthLabel(ym)} ${I18n.t('财务复盘报告')}`);
    lines.push('');
    lines.push(`${I18n.t('生成时间')}: ${Util.fmtDateTime(Date.now())}`);
    lines.push('');
    lines.push(`## ${I18n.t('收支概览')}`);
    lines.push('| 项目 | 金额 |');
    lines.push('| --- | ---: |');
    lines.push(`| ${I18n.t('收入')} | ¥${income.toFixed(2)} |`);
    lines.push(`| ${I18n.t('支出')} | ¥${expense.toFixed(2)} |`);
    lines.push(`| ${I18n.t('净结余')} | ¥${net.toFixed(2)} |`);
    lines.push(`| ${I18n.t('交易笔数')} | ${txs.length} |`);
    lines.push('');
    lines.push(`## ${I18n.t('本月发票明细')}`);
    lines.push(`| ${I18n.t('日期')} | ${I18n.t('类型')} | ${I18n.t('分类')} | ${I18n.t('账户')} | ${I18n.t('对方')} | ${I18n.t('金额')} |`);
    lines.push(`| --- | --- | --- | --- | --- | ---: |`);
    txs.slice().sort((a, b) => a.time - b.time).forEach(t => {
      const bc = Data.getCategoryBreadcrumb(t.categoryId, ' / ');
      const c = Data.getCategories().find(x => x.id === t.categoryId);
      const acc = Data.getAccount(t.accountId);
      const toAcc = t.toAccountId ? Data.getAccount(t.toAccountId) : null;
      const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '';
      const accStr = (acc ? acc.name : '—') + (toAcc ? ` → ${toAcc.name}` : '');
      lines.push(`| ${Util.fmtDate(t.time)} | ${tlabel[t.type] || t.type} | ${bc || (c ? c.name : '未分类')} | ${accStr} | ${t.payee || '其他'} | ${sign}${t.amount.toFixed(2)} |`);
    });
    lines.push('');
    Data.getAccounts().forEach(a => {
      const aTxs = txs.filter(t => t.accountId === a.id || t.toAccountId === a.id);
      if (!aTxs.length) return;
      let inc = 0, exp = 0;
      aTxs.forEach(t => {
        if (t.type === 'income' && t.accountId === a.id) inc += t.amount;
        else if (t.type === 'transfer' && t.toAccountId === a.id) inc += t.amount;
        else if (t.type === 'expense' && t.accountId === a.id) exp += t.amount;
        else if (t.type === 'transfer' && t.accountId === a.id) exp += t.amount;
      });
      lines.push(`## ${I18n.t('账户')}：${a.name}`);
      lines.push('| 项目 | 金额 |');
      lines.push('| --- | ---: |');
      lines.push(`| ${I18n.t('收入')} | ¥${inc.toFixed(2)} |`);
      lines.push(`| ${I18n.t('支出')} | ¥${exp.toFixed(2)} |`);
      lines.push(`| ${I18n.t('结余')} | ¥${(inc - exp).toFixed(2)} |`);
      lines.push(`| ${I18n.t('笔数')} | ${aTxs.length} |`);
      lines.push('');
      lines.push(`### ${a.name} ${I18n.t('明细')}`);
      lines.push(`| ${I18n.t('日期')} | ${I18n.t('类型')} | ${I18n.t('分类')} | ${I18n.t('对方/对手')} | ${I18n.t('金额')} |`);
      lines.push(`| --- | --- | --- | --- | ---: |`);
      aTxs.slice().sort((x, y) => x.time - y.time).forEach(t => {
        const bc = Data.getCategoryBreadcrumb(t.categoryId, ' / ');
        const c = Data.getCategories().find(x => x.id === t.categoryId);
        const other = t.type === 'transfer'
          ? (t.toAccountId === a.id ? '← ' + ((Data.getAccount(t.accountId) || {}).name || '—') : '→ ' + ((Data.getAccount(t.toAccountId) || {}).name || '—'))
          : (t.payee || '其他');
        const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : (t.toAccountId === a.id ? '+' : '-');
        lines.push(`| ${Util.fmtDate(t.time)} | ${tlabel[t.type] || t.type} | ${bc || (c ? c.name : '未分类')} | ${other} | ${sign}${t.amount.toFixed(2)} |`);
      });
      lines.push('');
    });
    Util.download(`月度复盘_${ym}.md`, lines.join('\n'), 'text/markdown');
    Util.toast(I18n.t('报告已导出'), 'success');
  };

  window.__printReport = () => { window.print(); };

  return { render };
})();
