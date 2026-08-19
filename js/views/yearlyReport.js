/* =========================================================
   views/yearlyReport.js — 年度复盘视图 v40+
   - 12 个月卡片网格:收入/支出/结余/储蓄率
   - Chart.js:月度收支 line,储蓄率 line,Top 分类 doughnut
   - 导出 Markdown
   ========================================================= */
const YearlyReportView = (() => {
  function buildMonthStats() {
    const now = new Date();
    const year = now.getFullYear();
    const months = [];
    for (let m = 0; m < 12; m++) {
      const start = new Date(year, m, 1).getTime();
      const end = new Date(year, m + 1, 1).getTime();
      const txs = Data.getTransactions().filter(t => t.time >= start && t.time < end);
      let inc = 0, exp = 0;
      txs.forEach(t => {
        if (t.type === 'income') inc += Number(t.amount || 0);
        else if (t.type === 'expense') exp += Number(t.amount || 0);
      });
      const net = inc - exp;
      const sr = inc > 0 ? Math.max(0, Math.min(1, net / inc)) : 0;
      months.push({ ym: year + '-' + String(m + 1).padStart(2, '0'), income: inc, expense: exp, net, savingsRate: sr, count: txs.length });
    }
    return { year, months };
  }

  function topCategoriesThisYear(limit) {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
    const txs = Data.getTransactions().filter(t => t.type === 'expense' && t.time >= yearStart);
    const map = {};
    txs.forEach(t => {
      if (!t.categoryId) return;
      const name = Data.getCategoryBreadcrumb(t.categoryId, ' / ');
      map[name] = (map[name] || 0) + Number(t.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, limit);
  }

  let charts = {};

  function render(root) {
    if (!root) return;
    const { year, months } = buildMonthStats();
    const top = topCategoriesThisYear(8);
    const totalIncome = months.reduce((s, m) => s + m.income, 0);
    const totalExpense = months.reduce((s, m) => s + m.expense, 0);
    const totalNet = totalIncome - totalExpense;
    const avgSavings = months.filter(m => m.income > 0).reduce((s, m) => s + m.savingsRate, 0) / Math.max(1, months.filter(m => m.income > 0).length);

    root.innerHTML = `
      <div class="page-header">
        <div class="page-header-ico" style="background: var(--brand-soft); color: var(--brand);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div class="page-header-text">
          <h1 data-i18n="年度复盘">${year} 年度复盘</h1>
          <p>12 个月收支走势 · 储蓄率 · 分类排行 · 一键导出 Markdown</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-ghost" id="yr-export">📄 导出 Markdown</button>
          <button class="btn btn-ghost" id="yr-print">🖨 打印</button>
        </div>
      </div>

      <div class="kpi-grid kpi-grid-4">
        <div class="kpi-card"><div class="kpi-card-label">全年收入</div><div class="kpi-card-value">¥${totalIncome.toFixed(2)}</div><div class="kpi-card-sub">${months.filter(m => m.income > 0).length} 个月有收入</div></div>
        <div class="kpi-card"><div class="kpi-card-label">全年支出</div><div class="kpi-card-value">¥${totalExpense.toFixed(2)}</div><div class="kpi-card-sub">${months.filter(m => m.expense > 0).length} 个月有支出</div></div>
        <div class="kpi-card"><div class="kpi-card-label">全年结余</div><div class="kpi-card-value" style="color: ${totalNet >= 0 ? 'var(--good)' : 'var(--bad)'};">${totalNet >= 0 ? '+' : ''}¥${totalNet.toFixed(2)}</div><div class="kpi-card-sub">${totalIncome > 0 ? ((totalNet / totalIncome) * 100).toFixed(1) : 0}% 结余率</div></div>
        <div class="kpi-card"><div class="kpi-card-label">平均储蓄率</div><div class="kpi-card-value">${(avgSavings * 100).toFixed(1)}%</div><div class="kpi-card-sub">仅计有收入月份</div></div>
      </div>

      <div class="card">
        <div class="card-title">12 月收支趋势</div>
        <div class="dc-chart-box"><canvas id="yr-trend"></canvas></div>
      </div>

      <div class="dc-grid-2">
        <div class="card">
          <div class="card-title">储蓄率走势</div>
          <div class="dc-chart-box"><canvas id="yr-savings"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">年度分类 Top 8</div>
          <div class="dc-chart-box"><canvas id="yr-cat"></canvas></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">12 月明细</div>
        <div class="yr-month-grid">
          ${months.map(m => `
            <div class="yr-month-card ${m.net < 0 ? 'is-neg' : ''}">
              <div class="yr-month-head">${m.ym.slice(5)}月</div>
              <div class="yr-month-row"><span>收入</span><b>¥${m.income.toFixed(0)}</b></div>
              <div class="yr-month-row"><span>支出</span><b>¥${m.expense.toFixed(0)}</b></div>
              <div class="yr-month-row"><span>结余</span><b style="color: ${m.net >= 0 ? 'var(--good)' : 'var(--bad)'};">${m.net >= 0 ? '+' : ''}¥${m.net.toFixed(0)}</b></div>
              <div class="yr-month-row"><span>储蓄率</span><b>${(m.savingsRate * 100).toFixed(0)}%</b></div>
              <div class="yr-month-row"><span>笔数</span><b>${m.count}</b></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    I18n.apply(root);

    // 销毁旧图
    Object.values(charts).forEach(c => c && c.destroy && c.destroy());
    charts = {};

    const theme = Util.chartTheme ? Util.chartTheme() : { tick: '#666', grid: '#eee' };
    const labels = months.map(m => m.ym.slice(5) + '月');

    // 收支趋势:双 bar + line
    const trendCtx = root.querySelector('#yr-trend').getContext('2d');
    charts.trend = new Chart(trendCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { type: 'bar', label: '收入', data: months.map(m => m.income), backgroundColor: 'rgba(0,185,107,.6)' },
          { type: 'bar', label: '支出', data: months.map(m => m.expense), backgroundColor: 'rgba(255,77,79,.6)' },
          { type: 'line', label: '结余', data: months.map(m => m.net), borderColor: '#2f54eb', backgroundColor: 'rgba(47,84,235,.1)', tension: .3, yAxisID: 'y' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { x: { ticks: { color: theme.tick } }, y: { ticks: { color: theme.tick }, grid: { color: theme.grid } } },
      },
    });

    // 储蓄率走势
    const savingsCtx = root.querySelector('#yr-savings').getContext('2d');
    charts.savings = new Chart(savingsCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{ label: '储蓄率', data: months.map(m => +(m.savingsRate * 100).toFixed(1)), borderColor: '#00b96b', backgroundColor: 'rgba(0,185,107,.15)', fill: true, tension: .3 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { ticks: { color: theme.tick, callback: v => v + '%' }, grid: { color: theme.grid } }, x: { ticks: { color: theme.tick } } },
      },
    });

    // Top 分类 doughnut
    if (top.length) {
      const catCtx = root.querySelector('#yr-cat').getContext('2d');
      charts.cat = new Chart(catCtx, {
        type: 'doughnut',
        data: {
          labels: top.map(t => t[0]),
          datasets: [{ data: top.map(t => t[1]), backgroundColor: Util.CHART_COLORS || ['#C7000B', '#00b96b', '#2f54eb', '#ff7d00', '#9254de', '#13c2c2', '#08979c', '#f5222d'] }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } },
        },
      });
    }

    // 导出 Markdown
    root.querySelector('#yr-export').addEventListener('click', () => {
      let md = `# ${year} 年度复盘\n\n`;
      md += `- 全年收入:¥${totalIncome.toFixed(2)}\n- 全年支出:¥${totalExpense.toFixed(2)}\n- 全年结余:${totalNet >= 0 ? '+' : ''}¥${totalNet.toFixed(2)}\n- 平均储蓄率:${(avgSavings * 100).toFixed(1)}%\n\n## 12 月明细\n\n| 月份 | 收入 | 支出 | 结余 | 储蓄率 | 笔数 |\n|---|---|---|---|---|---|\n`;
      months.forEach(m => {
        md += `| ${m.ym} | ¥${m.income.toFixed(2)} | ¥${m.expense.toFixed(2)} | ${m.net >= 0 ? '+' : ''}¥${m.net.toFixed(2)} | ${(m.savingsRate * 100).toFixed(0)}% | ${m.count} |\n`;
      });
      md += '\n## 年度分类 Top 8\n\n| 分类 | 金额 |\n|---|---|\n';
      top.forEach(t => { md += `| ${t[0]} | ¥${t[1].toFixed(2)} |\n`; });
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${year}年度复盘.md`; a.click();
      URL.revokeObjectURL(url);
      Util.toast('已导出 Markdown', 'success');
    });
    root.querySelector('#yr-print').addEventListener('click', () => window.print());
  }

  return { render };
})();
