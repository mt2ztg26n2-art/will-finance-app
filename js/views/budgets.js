/* =========================================================
   View: 预算管理
   ========================================================= */

const BudgetsView = (() => {

  function render(view) {
    const ym = Util.todayMonth();
    const [monthStart, monthEnd] = Util.monthRange(ym);
    const monthTxs = Data.getTransactions().filter(t => t.time >= monthStart && t.time < monthEnd);
    const categories = Data.getCategories('expense');
    const budget = Data.getBudgets().find(b => b.yearMonth === ym && !b.categoryId);
    const totalBudget = budget ? budget.amount : Data.getSettings().monthlyBudget || 3000;
    const monthExpense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const ratio = Math.min(1.5, monthExpense / Math.max(1, totalBudget));
    const status = ratio > 1 ? 'over' : ratio > 0.85 ? 'warn' : '';

    // v40+: 进入预算页时主动检查超支 → toast + notification + 红条
    try {
      const alertedKey = 'cfo:budget-alerted:' + ym + ':' + (budget ? budget.id : 'default');
      if (ratio > 1 && !sessionStorage.getItem(alertedKey)) {
        sessionStorage.setItem(alertedKey, '1');
        Util.toast(`预算已超支:${Util.monthLabel(ym)}已花 ¥${monthExpense.toFixed(2)} / 预算 ¥${totalBudget.toFixed(2)}`, 'warn', { sticky: true });
        Data.addNotification({
          type: 'budget', level: 'warn',
          title: '预算超支提醒',
          message: `${Util.monthLabel(ym)}总预算已超支 ${(ratio*100).toFixed(0)}%, 累计超 ¥${(monthExpense-totalBudget).toFixed(2)}。`,
          time: Date.now(),
          meta: { kind: 'page-visit', ym, amount: monthExpense, over: monthExpense - totalBudget, ratio },
        });
      }
    } catch (e) { /* sessionStorage 不可用时静默 */ }

    // 分类支出
    const catStats = categories.map(c => {
      const spent = monthTxs.filter(t => t.type === 'expense' && t.categoryId === c.id).reduce((s, t) => s + t.amount, 0);
      const catBudget = Data.getBudgets().find(b => b.yearMonth === ym && b.categoryId === c.id);
      const cr = catBudget ? spent / Math.max(1, catBudget.amount) : 0;
      return { cat: c, spent, budget: catBudget ? catBudget.amount : null, ratio: cr, over: cr > 1 };
    }).sort((a, b) => b.spent - a.spent);

    const totalSpentByCat = catStats.reduce((s, c) => s + c.spent, 0);

    view.innerHTML = `
      <div class="page-header">
        <div class="page-header-ico" style="background: var(--brand-soft); color: var(--brand);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/></svg>
        </div>
        <div class="page-header-text">
          <h1>${Util.monthLabel(ym)} 预算</h1>
          <p>超支会主动推送到「通知中心」+ 顶栏铃铛,月度总预算超额 10% 时再次提醒。</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-ghost btn-sm" onclick="window.__setTotalBudget(${totalBudget})">${Util.icon('pen')} 设定总预算</button>
        </div>
      </div>

      <div class="kpi-grid kpi-grid-4" style="margin-bottom:14px;">
        <div class="kpi-card"><div class="kpi-card-label">本月支出</div><div class="kpi-card-value">¥${monthExpense.toFixed(2)}</div><div class="kpi-card-sub">${monthTxs.filter(t => t.type === 'expense').length} 笔</div></div>
        <div class="kpi-card"><div class="kpi-card-label">总预算</div><div class="kpi-card-value">¥${totalBudget.toFixed(2)}</div><div class="kpi-card-sub">${budget ? '已自定义' : '使用系统默认'}</div></div>
        <div class="kpi-card"><div class="kpi-card-label">使用率</div><div class="kpi-card-value" style="color: ${ratio > 1 ? 'var(--bad)' : ratio > 0.85 ? 'var(--warn)' : 'var(--good)'};">${(ratio*100).toFixed(0)}%</div><div class="kpi-card-sub">${ratio > 1 ? '已超支' : ratio > 0.85 ? '即将超支' : '健康'}</div></div>
        <div class="kpi-card"><div class="kpi-card-label">超支分类</div><div class="kpi-card-value" style="color: ${catStats.some(c => c.over) ? 'var(--bad)' : 'var(--good)'};">${catStats.filter(c => c.over).length}</div><div class="kpi-card-sub">共 ${catStats.length} 个分类预算</div></div>
      </div>

      <div class="dash-row">
        <div class="card">
          <div class="card-title">
            <div class="card-title-text">
              ${Util.icon('pie','card-title-icon')}
              ${I18n.t('月度总预算进度')}
            </div>
          </div>
          <div style="text-align:center; padding:10px 0 20px;">
            <div style="font-size:34px; font-weight:800; font-family:'JetBrains Mono',monospace; color:${ratio > 1 ? 'var(--up)' : 'var(--brand-2)'}">
              ${(ratio * 100).toFixed(1)}%
            </div>
            <div style="color:var(--text-muted); margin-top:4px;">
              ${I18n.t('已支出 {a} / 预算 {b}', { a: Util.fmtMoney(monthExpense), b: Util.fmtMoney(totalBudget) })}
            </div>
          </div>
          <div class="gauge">
            <div class="gauge-bar"><div class="gauge-fill ${status} ${ratio > 1 ? 'gauge-flash' : ''}" style="width:${Math.min(100, ratio * 100)}%;"></div></div>
          </div>
          <div style="margin-top:14px; display:flex; justify-content:space-between; font-size:13px;">
            <span style="color:var(--text-muted);">${I18n.t('剩余预算')}</span>
            <span style="font-weight:700; color:${totalBudget - monthExpense < 0 ? 'var(--up)' : 'var(--brand-2)'}">
              ${Util.fmtMoney(totalBudget - monthExpense)}
            </span>
          </div>
          ${ratio > 1 ? `<div class="chip chip-warn" style="margin-top:12px;">${I18n.t('已超支 {a}', { a: Util.fmtMoney(monthExpense - totalBudget) })}</div>` : ''}
        </div>

        <div class="card">
          <div class="card-title">
            <div class="card-title-text">
              ${Util.icon('target','card-title-icon')}
              ${I18n.t('预算执行概览')}
            </div>
          </div>
          <div style="display:grid; gap:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-3); border-radius:var(--r-sm);">
              <span style="color:var(--text-muted);">${I18n.t('本月支出')}</span>
              <span style="font-weight:700;">${Util.fmtMoney(monthExpense)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-3); border-radius:var(--r-sm);">
              <span style="color:var(--text-muted);">${I18n.t('分类预算覆盖率')}</span>
              <span style="font-weight:700;">${catStats.filter(c => c.budget).length} / ${categories.length}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-3); border-radius:var(--r-sm);">
              <span style="color:var(--text-muted);">${I18n.t('预计月末')}</span>
              <span style="font-weight:700; color:var(--brand-2);">${Util.fmtMoney(totalBudget - monthExpense)}</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
              ${I18n.t('提示: 为分类设定预算可精准控制各类支出。下方可为每个分类设定月度预算。')}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <div class="card-title-text">
            ${Util.icon('bar-chart','card-title-icon')}
            ${I18n.t('分类预算 ({month})', { month: Util.monthLabel(ym) })}
          </div>
        </div>
        <div class="acc-grid" id="cat-budget-grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr));">
          ${catStats.map(c => {
            const r = c.budget ? Math.min(1.5, c.spent / Math.max(1, c.budget)) : (c.spent > 0 ? 0.2 : 0);
            const st = c.budget ? (r > 1 ? 'over' : r > 0.85 ? 'warn' : '') : '';
            return `
              <div style="padding:14px; border:1px solid var(--border); border-radius:var(--r-md); background:var(--bg-3);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-weight:600;">${c.cat.icon} ${Util.escapeHtml(c.cat.name)}</span>
                  <span style="font-size:12px; color:var(--text-muted);">${c.budget ? Util.fmtMoney(c.spent) + ' / ' + Util.fmtMoney(c.budget) : I18n.t('未设预算')}</span>
                </div>
                <div class="gauge" style="margin-top:10px;">
                  <div class="gauge-bar"><div class="gauge-fill ${st}" style="width:${Math.min(100, r * 100)}%;"></div></div>
                </div>
                <div style="margin-top:8px; text-align:right;">
                  <button class="chip" onclick="window.__setCatBudget('${c.cat.id}', ${c.budget || ''})">
                    ${c.budget ? I18n.t('调整') : I18n.t('设定')}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  window.__setTotalBudget = (current) => {
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="form-group">
        <label>${I18n.t('月度总预算 (元)')}</label>
        <input type="number" step="100" class="input" id="tb-amount" value="${current}" />
      </div>
      <div style="font-size:12px; color:var(--text-muted);">${I18n.t('该预算用于总支出预警。建议覆盖餐饮、交通、学习等全部生活支出。')}</div>
    `;
    Util.modal({
      title: I18n.t('设定月度总预算'),
      body,
      footer: `<button class="btn btn-ghost" data-act="close">${I18n.t('取消')}</button><button class="btn btn-primary" id="tb-save">${I18n.t('保存')}</button>`,
    });
    document.getElementById('tb-save').addEventListener('click', () => {
      const amount = parseFloat(document.getElementById('tb-amount').value);
      if (isNaN(amount) || amount <= 0) { Util.toast(I18n.t('请输入有效预算'), 'warn'); return; }
      Data.setBudget({ yearMonth: Util.todayMonth(), categoryId: null, amount });
      Data.updateSettings({ monthlyBudget: amount });
      Util.toast(I18n.t('预算已更新'), 'success');
      document.querySelector('.modal-mask')?.remove();
      render(document.getElementById('view'));
    });
  };

  window.__setCatBudget = (catId, current) => {
    const cat = Data.getCategories().find(c => c.id === catId);
    const body = document.createElement('div');
    body.innerHTML = `
      <div style="margin-bottom:12px; font-size:14px;">${I18n.t('分类:')} <strong>${cat ? cat.icon + ' ' + Util.escapeHtml(cat.name) : ''}</strong></div>
      <div class="form-group">
        <label>${I18n.t('月度预算 (元)')}</label>
        <input type="number" step="50" class="input" id="cb-amount" value="${current || ''}" placeholder="${I18n.t('如: 1200')}" />
      </div>
    `;
    Util.modal({
      title: I18n.t('设定分类预算'),
      body,
      footer: `<button class="btn btn-ghost" data-act="close">${I18n.t('取消')}</button><button class="btn btn-primary" id="cb-save">${I18n.t('保存')}</button>`,
    });
    document.getElementById('cb-save').addEventListener('click', () => {
      const amount = parseFloat(document.getElementById('cb-amount').value);
      if (isNaN(amount) || amount <= 0) { Util.toast(I18n.t('请输入有效预算'), 'warn'); return; }
      Data.setBudget({ yearMonth: Util.todayMonth(), categoryId: catId, amount });
      Util.toast(I18n.t('分类预算已更新'), 'success');
      document.querySelector('.modal-mask')?.remove();
      render(document.getElementById('view'));
    });
  };

  return { render };
})();
