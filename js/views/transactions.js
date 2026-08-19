/* =========================================================
   View: 交易记录 (银行级全路径)
   ========================================================= */

const TransactionsView = (() => {

  let filter = { type: 'all', account: 'all', category: 'all', q: '', dateFrom: '', dateTo: '' };
  let modalParsed = null;

  function render(view) {
    const accounts = Data.getAccounts();
    const categories = Data.getCategories();
    const types = [
      { v: 'all', label: I18n.t('全部') },
      { v: 'income', label: I18n.t('收入') },
      { v: 'expense', label: I18n.t('支出') },
      { v: 'transfer', label: I18n.t('转账') },
    ];

    view.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="tabs" id="tx-type-tabs">
            ${types.map(t => `<button class="tab ${t.v === 'all' ? 'active' : ''}" data-type="${t.v}">${t.label}</button>`).join('')}
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary btn-sm" onclick="window.__importTx()">${Util.icon('upload')} ${I18n.t('导入账单')}</button>
          <button class="btn btn-ghost btn-sm" onclick="window.__openTxModal()">＋ ${I18n.t('新增')}</button>
          <button class="btn btn-ghost btn-sm" onclick="window.__exportTx()">${Util.icon('download')} ${I18n.t('导出CSV')}</button>
        </div>
      </div>

      <div class="card">
        <div class="search-row" style="margin-bottom:16px;">
          <input type="text" class="input search-input" id="tx-search" placeholder="${I18n.t('搜索对方/用途/地点…')}" />
          <select class="input" id="tx-account-filter" style="width:160px;">
            <option value="all">${I18n.t('所有账户')}</option>
            ${accounts.map(a => `<option value="${a.id}">${Util.escapeHtml(a.name)}</option>`).join('')}
          </select>
          <select class="input" id="tx-category-filter" style="width:190px;">
            <option value="all">${I18n.t('所有分类')}</option>
            ${Data.getCategoryTree().map((group, gi, arr) => {
              if (arr.slice(0, gi).some(g => g.name === group.name)) return '';
              const leaves = Data.getLeafCategories().filter(l => { const p = Data.getCategoryPath(l.id); return p[0] && p[0].name === group.name; });
              if (!leaves.length) return '';
              return `<optgroup label="${Util.escapeHtml(group.name)}">${leaves.map(leaf => `<option value="${leaf.id}">${Util.escapeHtml(Data.getCategoryBreadcrumb(leaf.id, ' / '))}</option>`).join('')}</optgroup>`;
            }).join('')}
          </select>
          <input type="date" class="datepicker" id="tx-date-from" />
          <span style="color:var(--text-muted);">${I18n.t('至')}</span>
          <input type="date" class="datepicker" id="tx-date-to" />
          <button class="btn-icon-sm" title="${I18n.t('重置')}" onclick="window.__resetTxFilter()">
            ${Util.icon('refresh')}
          </button>
        </div>
        <div id="tx-table-wrap"></div>
      </div>
    `;

    bindEvents();
    renderTable();
  }

  function bindEvents() {
    Util.$$('#tx-type-tabs .tab').forEach(t => t.addEventListener('click', () => {
      Util.$$('#tx-type-tabs .tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      filter.type = t.dataset.type;
      renderTable();
    }));

    const search = document.getElementById('tx-search');
    search.addEventListener('input', Util.debounce(() => { filter.q = search.value.trim(); renderTable(); }, 300));
    document.getElementById('tx-account-filter').addEventListener('change', (e) => { filter.account = e.target.value; renderTable(); });
    document.getElementById('tx-category-filter').addEventListener('change', (e) => { filter.category = e.target.value; renderTable(); });
    document.getElementById('tx-date-from').addEventListener('change', (e) => { filter.dateFrom = e.target.value; renderTable(); });
    document.getElementById('tx-date-to').addEventListener('change', (e) => { filter.dateTo = e.target.value; renderTable(); });
  }

  function getFiltered() {
    let txs = Data.getTransactions();
    if (filter.type !== 'all') txs = txs.filter(t => t.type === filter.type);
    if (filter.account !== 'all') txs = txs.filter(t => t.accountId === filter.account || t.toAccountId === filter.account);
    if (filter.category !== 'all') txs = txs.filter(t => t.categoryId === filter.category);
    if (filter.q) {
      const q = filter.q.toLowerCase();
      txs = txs.filter(t =>
        (t.payee && t.payee.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.location && t.location.toLowerCase().includes(q))
      );
    }
    if (filter.dateFrom) txs = txs.filter(t => Util.fmtDate(t.time) >= filter.dateFrom);
    if (filter.dateTo) txs = txs.filter(t => Util.fmtDate(t.time) <= filter.dateTo);
    return txs;
  }

  function renderTable() {
    const wrap = document.getElementById('tx-table-wrap');
    if (!wrap) return;
    const txs = getFiltered();
    const accounts = Data.getAccounts();
    const categories = Data.getCategories();

    if (!txs.length) {
      wrap.innerHTML = '<div class="empty"><div class="empty-icon">' + Util.icon('search') + '</div><div class="empty-title">' + I18n.t('没有匹配的交易') + '</div><div class="empty-desc">' + I18n.t('试着调整筛选条件或新增交易') + '</div></div>';
      return;
    }

    const totalAmount = txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    wrap.innerHTML = `
      <div class="legend-row" style="margin-bottom:12px;">
        <span>${I18n.t('{n} 笔交易', { n: txs.length })}</span>
        <span style="color:var(--up)">${I18n.t('收入')} ${Util.fmtMoney(income)}</span>
        <span style="color:var(--down)">${I18n.t('支出')} ${Util.fmtMoney(expense)}</span>
        <span>${I18n.t('净额')} <strong style="color:${totalAmount >= 0 ? 'var(--brand-2)' : 'var(--up)'}">${Util.fmtMoney(totalAmount)}</strong></span>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>${I18n.t('时间')}</th>
            <th>${I18n.t('类型')}</th>
            <th>${I18n.t('分类')}</th>
            <th>${I18n.t('账户 / 路径')}</th>
            <th>${I18n.t('对方 / 用途')}</th>
            <th>${I18n.t('地点')}</th>
            <th style="text-align:right;">${I18n.t('金额')}</th>
            <th style="text-align:center; width:60px;">${I18n.t('回单')}</th>
          </tr>
        </thead>
        <tbody id="tx-tbody">
          ${txs.slice(0, 200).map(tx => {
            const acc = accounts.find(a => a.id === tx.accountId);
            const toAcc = tx.toAccountId ? accounts.find(a => a.id === tx.toAccountId) : null;
            const cat = categories.find(c => c.id === tx.categoryId);
            let sign = '', cls = '';
            if (tx.type === 'income') { sign = '+'; cls = 'in'; }
            else if (tx.type === 'expense') { sign = '-'; cls = 'out'; }
            else { sign = ''; cls = 'transfer'; }

            let path = '';
            if (tx.type === 'transfer') {
              path = `${acc ? acc.name : '?'} → ${toAcc ? toAcc.name : '?'}`;
            } else {
              path = acc ? acc.name : I18n.t('未知账户');
              if (tx.location || tx.payee) {
                path += ` → ${Util.escapeHtml([tx.payee, tx.location].filter(Boolean).join(' · '))}`;
              }
            }

            return `
              <tr onclick="window.__openTx('${tx.id}')">
                <td><div>${Util.fmtDate(tx.time)}</div><div style="font-size:11px;color:var(--text-dim)">${Util.fmtTime(tx.time)}</div></td>
                <td><span class="tag ${tx.type === 'income' ? 'tag-success' : tx.type === 'expense' ? 'tag-danger' : 'tag-info'}">${tx.type === 'income' ? I18n.t('收入') : tx.type === 'expense' ? I18n.t('支出') : I18n.t('转账')}</span></td>
                <td>${cat ? Util.icon(Util.categoryIcon(cat)) + ' ' + Util.escapeHtml(Data.getCategoryBreadcrumb(cat.id, ' / ')) : '—'}</td>
                <td>${Util.escapeHtml(path)}</td>
                <td>${Util.escapeHtml(tx.payee || tx.description || '—')}</td>
                <td>${Util.escapeHtml(tx.location || '—')}</td>
                <td style="text-align:right; font-family:'JetBrains Mono',monospace; font-weight:700;" class="tx-amount ${cls}">${sign}${Util.fmtMoney(tx.amount)}</td>
                <td style="text-align:center;" onclick="event.stopPropagation();">
                  <button class="btn-icon" title="生成电子储蓄单" onclick="event.stopPropagation(); window.Receipt.open('${tx.id}')">🧾</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      ${txs.length > 200 ? `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:12px;">${I18n.t('已显示前 200 笔,使用筛选查看全部')}</div>` : ''}
    `;
  }

  window.__openTxModal = (parsed = null) => {
    modalParsed = parsed;
    const accounts = Data.getAccounts();
    const incomeCats = Data.getCategories('income');
    const expenseCats = Data.getCategories('expense');
    const _firstLeafByType = (t) => Data.getLeafCategories(t)[0];

    const type = parsed?.type || 'expense';
    const amount = parsed?.amount || '';
    const accountId = parsed?.account?.id || accounts.find(a => a.type !== 'liability')?.id || '';
    const toAccountId = parsed?.toAccount?.id || accounts.find(a => a.type === 'business')?.id || accounts[1]?.id || '';
    const categoryId = parsed?.category?.id || (type === 'income' ? _firstLeafByType('income') : _firstLeafByType('expense')) || '';
    const payee = parsed?.payee || '';
    const location = parsed?.location || '';
    const description = parsed?.description || '';
    const time = parsed?.time || Date.now();

    const body = document.createElement('div');
    body.innerHTML = `
      <div class="tx-type-row">
        <div class="type-picker">
          <div class="type-pick in ${type === 'income' ? 'active' : ''}" data-t="income"><div class="type-pick-emoji">${Util.icon('arrow-down')}</div>${I18n.t('收入')}</div>
          <div class="type-pick out ${type === 'expense' ? 'active' : ''}" data-t="expense"><div class="type-pick-emoji">${Util.icon('arrow-up')}</div>${I18n.t('支出')}</div>
          <div class="type-pick transfer ${type === 'transfer' ? 'active' : ''}" data-t="transfer"><div class="type-pick-emoji">${Util.icon('arrow-left-right')}</div>${I18n.t('转账')}</div>
        </div>
      </div>

      <div class="form-group" id="m-cat-wrap" style="display:${type === 'transfer' ? 'none' : 'block'}">
        <label>${I18n.t('分类')}<span class="cat-crumb-hint">${I18n.t('下拉选择 · 大类 → 子类 → 小类')}</span></label>
        <div class="cat-cascader" id="m-cat-cascader">
          <button type="button" class="cat-cascader-trigger" id="m-cat-trigger">
            <span class="cat-cascader-value">${I18n.t('请选择分类')}</span>
            <span class="cat-cascader-caret">${Util.icon('chevron-down')}</span>
          </button>
          <div class="cat-cascader-pop" id="m-cat-pop" hidden></div>
        </div>
      </div>

      <div class="tx-amount-wrap">
        <span class="tx-amount-symbol">¥</span>
        <input type="number" step="0.01" class="tx-amount-big" id="m-amount" value="${amount}" placeholder="0.00" inputmode="decimal" />
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label id="m-acc-label">${I18n.t('账户')}</label>
          <select class="input" id="m-account">
            ${accounts.filter(a => a.type !== 'liability').map(a => `<option value="${a.id}" ${a.id === accountId ? 'selected' : ''}>${Util.escapeHtml(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="m-to-acc-wrap" style="display:${type === 'transfer' ? 'block' : 'none'}">
          <label>${I18n.t('转入账户')}</label>
          <select class="input" id="m-to-account">
            ${accounts.map(a => `<option value="${a.id}" ${a.id === toAccountId ? 'selected' : ''}>${Util.escapeHtml(a.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label>${I18n.t('时间')}</label>
          <input type="datetime-local" class="input" id="m-time" value="${toLocalInput(time)}" />
        </div>
        <div class="form-group">
          <label>${I18n.t('备注')}</label>
          <input type="text" class="input" id="m-desc" value="${Util.escapeHtml(description)}" placeholder="${I18n.t('选填')}" />
        </div>
      </div>

      <div class="more-options" id="m-more">
        <button type="button" class="more-toggle" id="m-more-toggle">${Util.icon('chevron-down')}<span>${I18n.t('更多选项')}</span></button>
        <div class="more-body" id="m-more-body" hidden>
          <div class="form-grid">
            <div class="form-group">
              <label>${I18n.t('对方 / 收款方')}</label>
              <input type="text" class="input" id="m-payee" value="${Util.escapeHtml(payee)}" placeholder="${I18n.t('如: 客户李、XX书店')}" />
            </div>
            <div class="form-group">
              <label>${I18n.t('地点')}</label>
              <div class="region-field" id="m-loc-wrap">
                <svg class="rf-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
                <input type="text" class="input rf-input" id="m-location" value="${Util.escapeHtml(location)}" placeholder="${I18n.t('省 / 市 / 区 — 点击选择')}" readonly />
                <button type="button" class="rf-clear" id="m-loc-clear" title="${I18n.t('清除')}" aria-label="清除">✕</button>
              </div>
              <input type="hidden" id="m-lat" value="${(parsed && parsed.lat) || ''}" />
              <input type="hidden" id="m-lng" value="${(parsed && parsed.lng) || ''}" />
            </div>
          </div>
        </div>
      </div>
    `;

    Util.modal({
      title: parsed ? I18n.t('确认记账 / 编辑') : I18n.t('新增交易'),
      body,
      footer: `
        <button class="btn btn-ghost" data-act="close">${I18n.t('取消')}</button>
        <button class="btn btn-primary" id="m-save-btn">${I18n.t('保存')}</button>
      `,
    });

    // 类型选择
    let curType = type;
    const initPath = categoryId ? Data.getCategoryPath(categoryId) : [];
    let navStack = initPath.slice(0, -1).map(c => c.id);
    let curCat = categoryId || '';

    function treeOfType(t) {
      function f(ns) { return ns.filter(n => n.type === t).map(n => Object.assign({}, n, { children: f(n.children) })); }
      return f(Data.getCategoryTree());
    }
    function renderCascader() {
      const trigger = document.getElementById('m-cat-trigger');
      const valueEl = trigger.querySelector('.cat-cascader-value');
      if (curCat) { valueEl.textContent = Data.getCategoryBreadcrumb(curCat, ' / '); trigger.classList.add('filled'); }
      else { valueEl.textContent = I18n.t('请选择分类'); trigger.classList.remove('filled'); }
      const pop = document.getElementById('m-cat-pop');
      if (pop.hidden) return;
      const tree = treeOfType(curType);
      const byId = {};
      (function idx(ns) { ns.forEach(n => { byId[n.id] = n; if (n.children) idx(n.children); }); })(tree);
      // 构建各列(大类 → 子类 → 小类)
      const cols = [];
      let level = tree;
      for (let i = 0; i <= navStack.length; i++) {
        if (i > 0) {
          const parent = byId[navStack[i - 1]];
          level = (parent && parent.children) ? parent.children : [];
        }
        if (!level.length) break;
        cols.push(level);
        const node = navStack[i] ? byId[navStack[i]] : null;
        if (!node || !(node.children && node.children.length)) break;
      }
      pop.innerHTML = cols.map((col, ci) => `
        <div class="cat-col" data-col="${ci}">
          ${col.map(c => {
            const hasKids = c.children && c.children.length;
            const sel = (navStack[ci] === c.id) || (curCat === c.id);
            return `<div class="cat-opt ${sel ? 'active' : ''} ${hasKids ? 'has-children' : ''}" data-cid="${c.id}" data-col="${ci}">
              <span class="cat-opt-name">${Util.escapeHtml(c.name)}</span>
              ${hasKids ? '<span class="cat-opt-caret">' + Util.icon('chevron-right') + '</span>' : ''}
            </div>`;
          }).join('')}
        </div>`).join('');
      Util.$$('.cat-opt', pop).forEach(opt => opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const cid = opt.dataset.cid;
        const ci = parseInt(opt.dataset.col, 10);
        const node = byId[cid];
        if (node.children && node.children.length) {
          navStack = navStack.slice(0, ci).concat([cid]);
          renderCascader();
        } else {
          curCat = cid;
          navStack = Data.getCategoryPath(cid).slice(0, -1).map(x => x.id);
          closeCascader();
          renderCascader();
        }
      }));
    }
    const catTrigger = document.getElementById('m-cat-trigger');
    const pop = document.getElementById('m-cat-pop');
    function onScrollResize() { closeCascader(); }
    function openCascader() {
      // Portal 到 body,避免被 .modal / .modal-body 的 overflow:hidden 裁剪
      if (pop.parentElement !== document.body) document.body.appendChild(pop);
      const rect = catTrigger.getBoundingClientRect();
      pop.style.position = 'fixed';
      pop.style.top = (rect.bottom + 6) + 'px';
      pop.style.left = rect.left + 'px';
      pop.style.minWidth = Math.max(rect.width, 132) + 'px';
      pop.style.zIndex = '1100';
      pop.hidden = false;
      renderCascader();
    }
    function closeCascader() {
      pop.hidden = true;
      pop.style.position = ''; pop.style.top = ''; pop.style.left = ''; pop.style.minWidth = ''; pop.style.zIndex = '';
      document.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    }
    catTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (pop.hidden) { openCascader(); document.addEventListener('scroll', onScrollResize, true); window.addEventListener('resize', onScrollResize); }
      else closeCascader();
    });
    document.addEventListener('click', (e) => {
      // pop 已 portal 到 body,需同时判定 trigger 和 pop
      if (!pop.hidden && !catTrigger.contains(e.target) && !pop.contains(e.target)) closeCascader();
    });
    renderCascader();

    const typePicks = Util.$$('.type-pick', body);
    typePicks.forEach(tp => tp.addEventListener('click', () => {
      curType = tp.dataset.t;
      typePicks.forEach(x => x.classList.remove('active'));
      tp.classList.add('active');
      document.getElementById('m-to-acc-wrap').style.display = curType === 'transfer' ? 'block' : 'none';
      document.getElementById('m-cat-wrap').style.display = curType === 'transfer' ? 'none' : 'block';
      document.getElementById('m-acc-label').textContent = curType === 'transfer' ? I18n.t('转出账户') : I18n.t('账户');
      navStack = [];
      const firstLeaf = Data.getLeafCategories(curType)[0];
      curCat = firstLeaf ? firstLeaf.id : '';
      renderCascader();
    }));

    // 更多选项折叠
    const moreToggle = document.getElementById('m-more-toggle');
    const moreBody = document.getElementById('m-more-body');
    if (moreToggle && moreBody) {
      moreToggle.addEventListener('click', () => {
        const open = !moreBody.hidden;
        moreBody.hidden = open;
        moreToggle.classList.toggle('open', !open);
      });
      if (payee || location) {
        moreBody.hidden = false;
        moreToggle.classList.add('open');
      }
    }

    // 金额自动获得焦点(银行级记账体验)
    setTimeout(() => { const a = document.getElementById('m-amount'); if (a) a.focus(); }, 60);

    document.getElementById('m-save-btn').addEventListener('click', () => {
      const amountVal = parseFloat(document.getElementById('m-amount').value);
      if (isNaN(amountVal) || amountVal <= 0) { Util.toast(I18n.t('请输入有效金额'), 'warn'); return; }
      const accId = document.getElementById('m-account').value;
      const toAccId = document.getElementById('m-to-account').value;
      const payee = document.getElementById('m-payee').value.trim();
      const loc = document.getElementById('m-location').value.trim();
      const desc = document.getElementById('m-desc').value.trim();
      const timeVal = new Date(document.getElementById('m-time').value).getTime() || Date.now();

      const lat = parseFloat(document.getElementById('m-lat').value);
      const lng = parseFloat(document.getElementById('m-lng').value);
      const tx = {
        type: curType,
        amount: amountVal,
        accountId: accId,
        toAccountId: curType === 'transfer' ? toAccId : null,
        categoryId: curType === 'transfer' ? null : curCat,
        payee, location: loc, description: desc,
        time: timeVal,
        lat: isNaN(lat) ? null : lat,
        lng: isNaN(lng) ? null : lng,
      };
      Data.addTransaction(tx);
      Util.toast(I18n.t('已保存交易'), 'success');
      document.querySelector('.modal-mask')?.remove();
      renderTable();
    });

    // 省/市/区 级联选择(替代地图选点)
    const mLocWrap = document.getElementById('m-loc-wrap');
    const mLocInput = document.getElementById('m-location');
    const openTxRegionPick = () => {
      if (window.RegionPicker) RegionPicker.open({ trigger: mLocInput, value: mLocInput.value, onSelect: (addr) => { mLocInput.value = addr; } });
    };
    if (mLocWrap) mLocWrap.addEventListener('click', (e) => { if (e.target.id !== 'm-loc-clear') openTxRegionPick(); });
    const mLocClear = document.getElementById('m-loc-clear');
    if (mLocClear) mLocClear.addEventListener('click', (e) => { e.stopPropagation(); mLocInput.value = ''; });
  };

  function toLocalInput(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  window.__openTx = (id) => {
    const tx = Data.getTransactions().find(t => t.id === id);
    if (!tx) return;
    const accounts = Data.getAccounts();
    const categories = Data.getCategories();
    const acc = accounts.find(a => a.id === tx.accountId);
    const toAcc = tx.toAccountId ? accounts.find(a => a.id === tx.toAccountId) : null;
    const cat = categories.find(c => c.id === tx.categoryId);

    const body = document.createElement('div');
    body.innerHTML = `
      <div style="margin-bottom:14px;">
        <div style="font-size:30px; font-weight:700; font-family:'JetBrains Mono',monospace; color:${tx.type === 'income' ? 'var(--up)' : tx.type === 'expense' ? 'var(--down)' : 'var(--info)'}">
          ${tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}${Util.fmtMoney(tx.amount)}
        </div>
        <div style="color:var(--text-muted); font-size:13px; margin-top:4px;">
          ${Util.fmtDateTime(tx.time)} · ${tx.type === 'income' ? I18n.t('收入') : tx.type === 'expense' ? I18n.t('支出') : I18n.t('转账')}
        </div>
      </div>
      <div style="display:grid; gap:10px;">
        <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">${I18n.t('分类')}</span><span>${cat ? Util.icon(Util.categoryIcon(cat)) + ' ' + Util.escapeHtml(Data.getCategoryBreadcrumb(cat.id, ' / ')) : '—'}</span></div>
        <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">${tx.type === 'transfer' ? I18n.t('转出') : I18n.t('账户')}</span><span>${acc ? Util.escapeHtml(acc.name) : '—'}</span></div>
        ${toAcc ? `<div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">${I18n.t('转入')}</span><span>${Util.escapeHtml(toAcc.name)}</span></div>` : ''}
        <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">${I18n.t('对方')}</span><span>${Util.escapeHtml(tx.payee || '—')}</span></div>
        <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">${I18n.t('地点')}</span><span>${Util.escapeHtml(tx.location || '—')}</span></div>
        <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">${I18n.t('用途')}</span><span>${Util.escapeHtml(tx.description || '—')}</span></div>
      </div>
    `;

    Util.modal({
      title: I18n.t('交易详情'),
      body,
      footer: `
        <button class="btn btn-ghost" data-act="close">${I18n.t('关闭')}</button>
        <button class="btn btn-ghost" id="m-receipt-btn">🧾 ${I18n.t('电子储蓄单')}</button>
        <button class="btn btn-ghost" id="m-edit-btn">${I18n.t('编辑')}</button>
        <button class="btn btn-danger" id="m-del-btn">${I18n.t('删除')}</button>
      `,
    });

    document.getElementById('m-edit-btn').addEventListener('click', () => {
      document.querySelector('.modal-mask')?.remove();
      window.__openTxModal(tx);
    });
    document.getElementById('m-receipt-btn').addEventListener('click', () => {
      document.querySelector('.modal-mask')?.remove();
      window.Receipt.open(id);
    });
    document.getElementById('m-del-btn').addEventListener('click', async () => {
      const ok = await Util.confirm(I18n.t('删除交易'), I18n.t('你确定要删除这条数据吗?账户余额将自动回滚。'), { okText: I18n.t('是'), cancelText: I18n.t('否'), danger: true });
      if (ok) {
        Data.deleteTransaction(id);
        Util.toast(I18n.t('已删除'), 'success');
        document.querySelector('.modal-mask')?.remove();
        renderTable();
      }
    });
  };

  window.__resetTxFilter = () => {
    filter = { type: 'all', account: 'all', category: 'all', q: '', dateFrom: '', dateTo: '' };
    document.getElementById('tx-search').value = '';
    document.getElementById('tx-account-filter').value = 'all';
    document.getElementById('tx-category-filter').value = 'all';
    document.getElementById('tx-date-from').value = '';
    document.getElementById('tx-date-to').value = '';
    Util.$$('#tx-type-tabs .tab').forEach(x => x.classList.toggle('active', x.dataset.type === 'all'));
    renderTable();
  };

  window.__exportTx = () => {
    const txs = getFiltered();
    const accounts = Data.getAccounts();
    const categories = Data.getCategories();
    const rows = txs.map(t => {
      const acc = accounts.find(a => a.id === t.accountId);
      const toAcc = t.toAccountId ? accounts.find(a => a.id === t.toAccountId) : null;
      const cat = categories.find(c => c.id === t.categoryId);
      return [
        Util.fmtDateTime(t.time),
        t.type,
        cat ? cat.name : '',
        acc ? acc.name : '',
        toAcc ? toAcc.name : '',
        t.payee || '',
        t.location || '',
        t.description || '',
        t.amount,
      ];
    });
    const csv = Util.toCSV(rows, [I18n.t('时间'), I18n.t('类型'), I18n.t('分类'), I18n.t('账户'), I18n.t('转入账户'), I18n.t('对方'), I18n.t('地点'), I18n.t('用途'), I18n.t('金额')]);
    Util.download(`交易记录_${Util.fmtDate(Date.now())}.csv`, '﻿' + csv, 'text/csv');
    Util.toast(I18n.t('已导出 CSV'), 'success');
  };

  // ---------- 导入账单 ----------
  window.__importTx = () => {
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="import-zone" id="imp-zone">
        <div style="display:grid;place-items:center;gap:6px;">
          ${Util.icon('upload')}
          <div style="font-weight:700;">${I18n.t('点击或拖拽上传账单文件')}</div>
          <div class="import-hint">${I18n.t('支持 <code>.csv</code> / <code>.txt</code> / <code>.json</code> · 也可直接粘贴文本')}</div>
        </div>
        <input type="file" id="imp-file" accept=".csv,.txt,.json,text/csv,text/plain,application/json" style="display:none;" />
      </div>
      <div class="form-group" style="margin-top:12px;">
        <label>${I18n.t('或直接粘贴账单文本（每行一笔；也可用一句话如「今天食堂吃饭25元」）')}</label>
        <textarea class="input" id="imp-text" rows="5" placeholder="2026-08-01,支出,25,餐饮,招商银行卡,食堂&#10;2026-08-02,收入,2500,父母生活费,招商银行卡,父母&#10;今天麦当劳吃饭 32"></textarea>
      </div>
      <div id="imp-preview"></div>
    `;
    Util.modal({ title: I18n.t('导入账单'), body, footer: `<button class="btn btn-ghost" data-act="close">${I18n.t('取消')}</button><button class="btn btn-primary" id="imp-parse">${I18n.t('解析预览')}</button><button class="btn btn-primary" id="imp-confirm" style="display:none;">${I18n.t('确认导入')}</button>` });

    const fileInput = document.getElementById('imp-file');
    const zone = document.getElementById('imp-zone');
    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dz-hover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dz-hover'));
    zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('dz-hover'); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) readFile(fileInput.files[0]); });

    let parsedRows = [];
    function readFile(f) {
      const reader = new FileReader();
      reader.onload = () => { document.getElementById('imp-text').value = reader.result; };
      reader.readAsText(f);
    }

    document.getElementById('imp-parse').addEventListener('click', () => {
      const text = document.getElementById('imp-text').value;
      parsedRows = parseImport(text);
      renderPreview();
    });

    function renderPreview() {
      const wrap = document.getElementById('imp-preview');
      const confirmBtn = document.getElementById('imp-confirm');
      const parseBtn = document.getElementById('imp-parse');
      if (!parsedRows.length) {
        wrap.innerHTML = '<div class="empty"><div class="empty-desc">' + I18n.t('没有可解析的记录，请检查格式') + '</div></div>';
        confirmBtn.style.display = 'none'; parseBtn.style.display = ''; return;
      }
      const rows = parsedRows.slice(0, 50).map(r => `
        <tr>
          <td>${Util.fmtDate(r.time)}</td>
          <td><span class="tag ${r.type === 'income' ? 'tag-success' : r.type === 'expense' ? 'tag-danger' : 'tag-info'}">${r.type === 'income' ? I18n.t('收入') : r.type === 'expense' ? I18n.t('支出') : I18n.t('转账')}</span></td>
          <td>${Util.fmtMoney(r.amount)}</td>
          <td>${Util.escapeHtml(r._account || '—')}</td>
          <td>${Util.escapeHtml(r._category || '—')}</td>
          <td>${Util.escapeHtml(r.payee || '')}</td>
        </tr>`).join('');
      wrap.innerHTML = `<div class="import-preview"><table><thead><tr><th>${I18n.t('日期')}</th><th>${I18n.t('类型')}</th><th>${I18n.t('金额')}</th><th>${I18n.t('账户')}</th><th>${I18n.t('分类')}</th><th>${I18n.t('对方')}</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div style="margin-top:8px;font-size:12px;color:var(--text-2);">${I18n.t('共解析 {n} 笔，确认后将写入交易记录并与账户余额同步。', { n: parsedRows.length })}</div>`;
      confirmBtn.style.display = ''; parseBtn.style.display = 'none';
    }

    document.getElementById('imp-confirm').addEventListener('click', () => {
      if (!parsedRows.length) return;
      let n = 0;
      parsedRows.forEach(r => {
        Data.addTransaction({
          type: r.type, amount: r.amount, accountId: r.accountId,
          toAccountId: r.toAccountId || null, categoryId: r.categoryId || null,
          payee: r.payee, location: r.location, description: r.description, time: r.time,
        });
        n++;
      });
      Util.toast(I18n.t('已导入 {n} 笔交易', { n }), 'success');
      document.querySelector('.modal-mask')?.remove();
      renderTable();
    });
  };

  // 解析导入文本：CSV(带/不带表头) / JSON / 自由文本(走 Parser)
  function parseImport(text) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const accounts = Data.getAccounts();
    const categories = Data.getCategories();
    const defaultAcc = (accounts.find(a => a.type !== 'liability') || accounts[0] || {}).id || null;

    if (raw.startsWith('[')) {
      try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr.filter(o => o && o.amount).map(o => normalizeObj(o, accounts, categories, defaultAcc)); } catch (e) {}
    }
    const first = lines[0];
    const isCsvHeader = /金额|amount/i.test(first) && first.includes(',');
    let colMap = null; let dataLines = lines;
    if (isCsvHeader) { colMap = buildColMap(first.split(',').map(s => s.trim())); dataLines = lines.slice(1); }
    const out = [];
    for (const line of dataLines) {
      if (line.startsWith('{')) { try { const o = JSON.parse(line); if (o && o.amount) { out.push(normalizeObj(o, accounts, categories, defaultAcc)); } continue; } catch (e) {} }
      if (isCsvHeader && colMap) {
        out.push(fromCsvRow(line.split(',').map(s => s.trim()), colMap, accounts, categories, defaultAcc));
      } else if (line.includes(',')) {
        out.push(fromCsvRow(line.split(',').map(s => s.trim()), BARE_CSV_MAP, accounts, categories, defaultAcc));
      } else {
        const p = Parser.parse(line, { accounts, categories });
        out.push({
          time: p.time, type: p.type, amount: p.amount || 0,
          accountId: p.account ? p.account.id : defaultAcc,
          toAccountId: p.toAccount ? p.toAccount.id : null,
          categoryId: p.category ? p.category.id : null,
          payee: p.payee, location: p.location, description: p.description,
          _account: p.account ? p.account.name : '', _category: p.category ? p.category.name : '',
        });
      }
    }
    return out.filter(r => r.amount > 0);
  }

  const BARE_CSV_MAP = { date: 0, type: 1, amount: 2, category: 3, account: 4, payee: 5, note: 6, toAccount: 7 };

  function buildColMap(headers) {
    const map = {};
    headers.forEach((h, i) => {
      if (/日期|date|时间/.test(h)) map.date = i;
      else if (/类型|type/.test(h)) map.type = i;
      else if (/金额|amount|数额|price/.test(h.toLowerCase())) map.amount = i;
      else if (/分类|category|类目/.test(h)) map.category = i;
      else if (/用途|备注|note|desc|摘要|说明/.test(h)) map.note = i;
      else if (/转入|目标账户|to/.test(h)) map.toAccount = i;
      else if (/对方|payee|商户|收款/.test(h)) map.payee = i;
      else if (/账户|account|卡|钱包/.test(h)) map.account = i;
    });
    return map;
  }

  function fromCsvRow(parts, map, accounts, categories, defaultAcc) {
    const get = (k) => (map[k] != null && parts[map[k]] != null) ? parts[map[k]] : '';
    const time = parseDate(get('date'));
    const type = mapType(get('type'));
    const amount = parseFloat(String(get('amount')).replace(/[^\d.]/g, '')) || 0;
    const accountId = findAccount(get('account'), accounts) || defaultAcc;
    const toAccountId = findAccount(get('toAccount'), accounts);
    const categoryId = findCategory(get('category'), type, categories);
    return {
      time, type, amount, accountId, toAccountId, categoryId,
      payee: get('payee'), location: '', description: get('note'),
      _account: (accounts.find(a => a.id === accountId) || {}).name || '',
      _category: (categories.find(c => c.id === categoryId) || {}).name || '',
    };
  }

  function normalizeObj(o, accounts, categories, defaultAcc) {
    const time = o.time ? (typeof o.time === 'number' ? o.time : parseDate(o.time)) : Date.now();
    const type = mapType(o.type || 'expense');
    const amount = Number(o.amount) || 0;
    const accountId = findAccount(o.account || o.accountId || o.accountName, accounts) || defaultAcc;
    const toAccountId = findAccount(o.toAccount || o.toAccountId, accounts);
    const categoryId = findCategory(o.category || o.categoryName, type, categories);
    return {
      time, type, amount, accountId, toAccountId, categoryId,
      payee: o.payee || o.merchant || '', location: o.location || '', description: o.note || o.description || '',
      _account: (accounts.find(a => a.id === accountId) || {}).name || '',
      _category: (categories.find(c => c.id === categoryId) || {}).name || '',
    };
  }

  function parseDate(s) {
    s = String(s || '').trim();
    if (/^\d{10,}$/.test(s)) return Number(s) * (s.length === 10 ? 1000 : 1);
    const m = s.match(/(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})(?:[ T](\d{1,2})[:：](\d{1,2}))?/);
    if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0); if (!isNaN(d)) return d.getTime(); }
    const t = Date.parse(s);
    return isNaN(t) ? Date.now() : t;
  }
  function mapType(s) {
    const v = String(s || '').toLowerCase();
    if (/收入|收|in|income|到账|回款/.test(v)) return 'income';
    if (/转账|transfer|转/.test(v)) return 'transfer';
    return 'expense';
  }
  function findAccount(name, accounts) {
    if (!name) return null;
    const n = String(name).trim();
    const hit = accounts.find(a => a.name === n) || accounts.find(a => a.name.includes(n) || n.includes(a.name));
    return hit ? hit.id : null;
  }
  function findCategory(name, type, categories) {
    if (!name) return null;
    const n = String(name).trim();
    const pool = categories.filter(c => c.type === type || c.type === 'all');
    const hit = pool.find(c => c.name === n) || pool.find(c => c.name.includes(n) || n.includes(c.name));
    return hit ? hit.id : (pool[0] ? pool[0].id : null);
  }

  return { render };
})();
