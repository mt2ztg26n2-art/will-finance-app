/* =========================================================
   View: 负债管理 (花呗/信用卡/贷款 + 还款提醒)
   ========================================================= */

const LiabilitiesView = (() => {

  const typeMeta = {
    huabei: { key: '花呗', icon: 'credit-card', color: '#5b9bd5' },
    creditcard: { key: '信用卡', icon: 'credit-card', color: '#163e6e' },
    loan: { key: '贷款', icon: 'landmark', color: '#5b9bd5' },
    jiebei: { key: '借呗', icon: 'wallet', color: '#2f6cab' },
    other: { key: '其他负债', icon: 'receipt', color: '#8fc0e3' },
  };

  function typeLabel(t) {
    return I18n.t((typeMeta[t] || typeMeta.other).key);
  }

  function render(view) {
    const liabilities = Data.getLiabilities();
    const totals = Data.totals();

    const totalDebt = liabilities.reduce((s, l) => s + Math.abs(Number(l.remaining || 0)), 0);
    const totalPaid = liabilities.reduce((s, l) => s + Math.abs(Number(l.paid || 0)), 0);
    const totalPrincipal = liabilities.reduce((s, l) => s + Math.abs(Number(l.total || 0)), 0);
    const monthlyTotal = liabilities.reduce((s, l) => s + Math.abs(Number(l.monthlyPayment || 0)), 0);
    const repayCount = liabilities.filter(l => l.remind).length;

    view.innerHTML = `
      <div class="kpi-row">
        <div class="kpi-cell"><div class="kpi-label">${I18n.t('总负债')}</div><div class="kpi-value" style="color:var(--up)">${Util.fmtMoney(totalDebt)}</div></div>
        <div class="kpi-cell"><div class="kpi-label">${I18n.t('已还本金')}</div><div class="kpi-value" style="color:var(--down)">${Util.fmtMoney(totalPaid)}</div></div>
        <div class="kpi-cell"><div class="kpi-label">${I18n.t('月还款总额')}</div><div class="kpi-value" style="color:var(--warn)">${Util.fmtMoney(monthlyTotal)}</div></div>
        <div class="kpi-cell"><div class="kpi-label">${I18n.t('待还账户')}</div><div class="kpi-value">${liabilities.length}</div></div>
      </div>

      <div class="dash-row">
        <div class="card">
          <div class="card-title">
            <div class="card-title-text">
              ${Util.icon('info','card-title-icon')}
              ${I18n.t('负债清单')}
            </div>
            <button class="btn btn-primary btn-sm" onclick="window.__addLiability()">＋ ${I18n.t('新增负债')}</button>
          </div>
          <div class="debt-list" id="debt-list"></div>
        </div>

        <div class="card">
          <div class="card-title"><div class="card-title-text">${Util.icon('pie', 'card-title-icon')} ${I18n.t('负债占比 & 净资产影响')}</div></div>
          <div style="display:grid; gap:12px; margin-top:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-3); border-radius:var(--r-md);">
              <span style="color:var(--text-muted);">${I18n.t('总资产')}</span><span style="font-weight:700;">${Util.fmtMoney(totals.totalAssets)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-3); border-radius:var(--r-md);">
              <span style="color:var(--text-muted);">${I18n.t('总负债')}</span><span style="font-weight:700; color:var(--up);">${Util.fmtMoney(totals.totalLiabilities)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-3); border-radius:var(--r-md); border:1px solid var(--brand);">
              <span style="color:var(--text-muted);">${I18n.t('净资产')}</span><span style="font-weight:700; color:var(--brand-2);">${Util.fmtMoney(totals.netAssets)}</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); padding:6px;">
              ${I18n.t('负债占资产比例:')} <strong style="color:var(--up)">${(totals.totalAssets > 0 ? (totals.totalLiabilities / totals.totalAssets * 100) : 0).toFixed(1)}%</strong>
              ${totals.totalAssets > 0 && (totals.totalLiabilities / totals.totalAssets) < 0.3 ? I18n.t('处于健康区间') : I18n.t('负债偏高,注意控制')}
            </div>
          </div>
        </div>
      </div>

      <div class="card" id="debt-linked" style="margin-top:14px;">
        <div class="card-title"><div class="card-title-text">${Util.icon('link','card-title-icon')} ${I18n.t('总表关联记录 · 负债支出')}</div>
          <span class="card-title-sub">${I18n.t('在「记一笔 / 交易」选「负债」分类自动汇总')}</span></div>
        <div id="debt-linked-body"></div>
      </div>
    `;

    renderList(liabilities);

    renderLinkedDebt();
  }

  function renderLinkedDebt() {
    const host = document.getElementById('debt-linked-body');
    if (!host) return;
    const root = Data.getCategories().find(c => c.name === '负债' && !c.parent);
    const txs = root ? Data.getTransactions().filter(t => {
      if (!t.categoryId) return false;
      const path = Data.getCategoryPath(t.categoryId);
      return path.length && path[0] && path[0].id === root.id;
    }) : [];
    const total = txs.reduce((s, t) => s + (t.type === 'expense' ? Number(t.amount || 0) : 0), 0);
    const recent = txs.slice().sort((a, b) => b.time - a.time).slice(0, 6);
    if (!txs.length) {
      host.innerHTML = '<div class="empty" style="padding:18px;"><div class="empty-desc">' + I18n.t('还没有「负债」类交易。去「记一笔」选择「负债」分类,记录会自动汇总到这里。') + '</div></div>';
      return;
    }
    host.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-3);">
        <span style="color:var(--text-muted); font-size:13px;">${I18n.t('负债类实际支出合计')}</span>
        <span style="font-weight:800; color:var(--up); font-size:18px;">${Util.fmtMoney(total)}</span>
      </div>
      <div class="tx-mini-list">
        ${recent.map(t => `<div class="tx-mini-row">
          <span class="tx-mini-cat">${Util.icon(Util.categoryIcon(Data.getCategoryById(t.categoryId)))} ${Util.escapeHtml(Data.getCategoryBreadcrumb(t.categoryId, ' / '))}</span>
          <span class="tx-mini-amt" style="color:var(--up)">-${Util.fmtMoney(t.amount)}</span>
          <span class="tx-mini-date">${Util.fmtDate(t.time)}</span>
        </div>`).join('')}
      </div>
      <div style="padding:8px 14px;"><a class="link-btn" onclick="Router.navigate('transactions')">${I18n.t('查看全部交易 →')}</a></div>
    `;
  }

  function renderList(liabilities) {
    const list = document.getElementById('debt-list');
    if (!list) return;
    if (!liabilities.length) {
      list.innerHTML = '<div class="empty"><div class="empty-icon">' + Util.icon('check') + '</div><div class="empty-title">' + I18n.t('暂无负债') + '</div><div class="empty-desc">' + I18n.t('恭喜!当前没有待还债务') + '</div></div>';
      return;
    }
    list.innerHTML = liabilities.map(l => {
      const meta = typeMeta[l.type] || typeMeta.other;
      const ratio = l.total > 0 ? (l.remaining / l.total) * 100 : 0;
      const paidRatio = l.total > 0 ? (l.paid / l.total) * 100 : 0;
      return `
        <div class="debt-item">
          <div class="debt-icon" style="color:${meta.color}; background:${meta.color}22;">${Util.icon(meta.icon)}</div>
          <div class="debt-body">
            <div class="debt-title">${Util.escapeHtml(l.name)} <span class="tag" style="background:${meta.color}22;color:${meta.color}">${typeLabel(l.type)}</span></div>
            <div class="debt-sub">${I18n.t('每月还款')} ${Util.fmtMoney(l.monthlyPayment || 0)} · ${I18n.t('还款日每月')} ${l.dueDate || '--'} ${I18n.t('号')} · ${l.remind ? I18n.t('提醒开启') : I18n.t('提醒关闭')}</div>
            <div class="gauge" style="margin-top:8px;">
              <div class="gauge-bar"><div class="gauge-fill over" style="width:${Math.max(4, paidRatio)}%;"></div></div>
              <div class="gauge-meta"><span>${I18n.t('已还 {a}', { a: Util.fmtMoney(l.paid || 0) })}</span><span>${I18n.t('剩余 {a}', { a: Util.fmtMoney(l.remaining || 0) })}</span></div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
            <div class="debt-amount" style="color:var(--up);">${Util.fmtMoney(l.remaining || 0)}</div>
            <button class="btn btn-ghost btn-sm" onclick="window.__repayLiability('${l.id}')">${I18n.t('还款')}</button>
            <button class="btn btn-ghost btn-sm" onclick="window.__editLiability('${l.id}')">${I18n.t('编辑')}</button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.__addLiability = () => openModal(null);
  window.__editLiability = (id) => openModal(id);
  window.__deleteLiability = async (id) => {
    const l = Data.getLiabilities().find(x => x.id === id);
    if (!l) return;
    const ok = await Util.confirm(I18n.t('删除负债'), I18n.t('确定删除「{n}」吗?', { n: l.name }), { okText: I18n.t('是'), cancelText: I18n.t('否'), danger: true });
    if (ok) { Data.deleteLiability(id); Util.toast(I18n.t('已删除'), 'success'); render(document.getElementById('view')); updateBadges(); }
  };

  window.__repayLiability = (id) => {
    const l = Data.getLiabilities().find(x => x.id === id);
    if (!l) return;
    const body = document.createElement('div');
    body.innerHTML = `
      <div style="margin-bottom:12px; padding:14px; background:var(--bg-3); border-radius:var(--r-md);">
        <div style="font-size:12px;color:var(--text-muted);">${I18n.t('剩余待还')}</div>
        <div style="font-size:22px;font-weight:700;color:var(--up);font-family:'JetBrains Mono',monospace;">${Util.fmtMoney(l.remaining || 0)}</div>
      </div>
      <div class="form-group">
        <label>${I18n.t('本次还款金额')}</label>
        <input type="number" step="0.01" class="input" id="r-amount" value="${l.monthlyPayment || l.remaining || 0}" />
      </div>
      <div style="font-size:12px;color:var(--text-muted);">${I18n.t('还款后将自动更新剩余金额并生成还款记录。')}</div>
    `;
    Util.modal({
      title: I18n.t('还款') + ' · ' + Util.escapeHtml(l.name),
      body,
      footer: `<button class="btn btn-ghost" data-act="close">${I18n.t('取消')}</button><button class="btn btn-primary" id="r-save">${I18n.t('确认还款')}</button>`,
    });
    document.getElementById('r-save').addEventListener('click', () => {
      const amt = parseFloat(document.getElementById('r-amount').value);
      if (isNaN(amt) || amt <= 0) { Util.toast(I18n.t('请输入有效金额'), 'warn'); return; }
      const remaining = Math.max(0, (l.remaining || 0) - amt);
      const paid = (l.paid || 0) + amt;
      Data.updateLiability(id, { remaining, paid });
      Data.addNotification({
        type: 'debt',
        title: I18n.t('还款成功'),
        message: `已还款 ${Util.fmtMoney(amt)} 至「${l.name}」,剩余 ${Util.fmtMoney(remaining)}。`,
        time: Date.now(),
      });
      Util.toast(I18n.t('还款成功'), 'success');
      document.querySelector('.modal-mask')?.remove();
      render(document.getElementById('view'));
      updateBadges();
    });
  };

  function openModal(id) {
    const l = id ? Data.getLiabilities().find(x => x.id === id) : null;
    const types = Object.keys(typeMeta);
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="form-group"><label>${I18n.t('负债名称')}</label><input type="text" class="input" id="l-name" value="${Util.escapeHtml(l?.name || '')}" placeholder="${I18n.t('如: 花呗')}" /></div>
      <div class="form-group"><label>${I18n.t('类型')}</label><select class="input" id="l-type">${types.map(t => `<option value="${t}" ${t === (l?.type || 'huabei') ? 'selected' : ''}>${typeLabel(t)}</option>`).join('')}</select></div>
      <div class="split-2">
        <div class="form-group"><label>${I18n.t('负债总额')}</label><input type="number" step="0.01" class="input" id="l-total" value="${l?.total || 0}" /></div>
        <div class="form-group"><label>${I18n.t('已还金额')}</label><input type="number" step="0.01" class="input" id="l-paid" value="${l?.paid || 0}" /></div>
      </div>
      <div class="split-2">
        <div class="form-group"><label>${I18n.t('每月还款')}</label><input type="number" step="0.01" class="input" id="l-monthly" value="${l?.monthlyPayment || 0}" /></div>
        <div class="form-group"><label>${I18n.t('还款日 (号)')}</label><input type="number" min="1" max="31" class="input" id="l-due" value="${l?.dueDate || 1}" /></div>
      </div>
      <div class="form-group"><label>${I18n.t('备注')}</label><input type="text" class="input" id="l-note" value="${Util.escapeHtml(l?.note || '')}" placeholder="${I18n.t('如: 主要用于数码和差旅')}" /></div>
      <label style="display:flex; gap:8px; align-items:center; font-size:13px; color:var(--text-muted);"><input type="checkbox" id="l-remind" ${l?.remind !== false ? 'checked' : ''} /> ${I18n.t('开启还款提醒')}</label>
    `;
    Util.modal({
      title: l ? I18n.t('编辑负债') : I18n.t('新增负债'),
      body,
      footer: `<button class="btn btn-ghost" data-act="close">${I18n.t('取消')}</button><button class="btn btn-primary" id="l-save">${I18n.t('保存')}</button>`,
    });
    document.getElementById('l-save').addEventListener('click', () => {
      const name = document.getElementById('l-name').value.trim();
      if (!name) { Util.toast(I18n.t('请输入名称'), 'warn'); return; }
      const total = parseFloat(document.getElementById('l-total').value) || 0;
      const paid = parseFloat(document.getElementById('l-paid').value) || 0;
      const patch = {
        name,
        type: document.getElementById('l-type').value,
        total,
        paid,
        remaining: total - paid,
        monthlyPayment: parseFloat(document.getElementById('l-monthly').value) || 0,
        dueDate: parseInt(document.getElementById('l-due').value) || 1,
        note: document.getElementById('l-note').value.trim(),
        remind: document.getElementById('l-remind').checked,
      };
      if (l) Data.updateLiability(id, patch);
      else Data.addLiability(patch);
      Util.toast(I18n.t('已保存'), 'success');
      document.querySelector('.modal-mask')?.remove();
      render(document.getElementById('view'));
      updateBadges();
    });
  }

  function updateBadges() {
    const debts = Data.getLiabilities().filter(l => l.remind && l.remaining > 0);
    const badge = document.getElementById('debt-badge');
    if (badge) {
      if (debts.length) { badge.textContent = '!'; badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    }
  }

  return { render, updateBadges };
})();
