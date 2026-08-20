/* =========================================================
   View: 教育投资 (时间 + 地点)
   ========================================================= */

const EducationView = (() => {

  let view_mode = 'timeline'; // timeline / location

  function render(view) {
    const stages = Data.getEducationStages();
    const total = stages.reduce((s, e) => s + (e.total || 0), 0);
    const totalTuition = stages.reduce((s, e) => s + (e.tuition || 0), 0);
    const totalLiving = stages.reduce((s, e) => s + (e.living || 0), 0);
    const totalBooks = stages.reduce((s, e) => s + (e.books || 0), 0);

    view.innerHTML = `
      <div class="kpi-row kpi-row-4" style="margin-bottom:14px;">
        <div class="kpi-cell"><div class="kpi-label">${I18n.t('教育累计投入')}</div><div class="kpi-value" style="color:var(--info)">${Util.fmtMoney(total)}</div></div>
        <div class="kpi-cell"><div class="kpi-label">${I18n.t('学费合计')}</div><div class="kpi-value">${Util.fmtMoney(totalTuition)}</div></div>
        <div class="kpi-cell"><div class="kpi-label">${I18n.t('生活合计')}</div><div class="kpi-value">${Util.fmtMoney(totalLiving)}</div></div>
        <div class="kpi-cell"><div class="kpi-label">${I18n.t('教材合计')}</div><div class="kpi-value">${Util.fmtMoney(totalBooks)}</div></div>
      </div>

      <div class="toolbar">
        <div class="toolbar-left">
          <div class="tabs">
            <button class="tab ${view_mode === 'timeline' ? 'active' : ''}" data-mode="timeline">${I18n.t('时间轴')}</button>
            <button class="tab ${view_mode === 'location' ? 'active' : ''}" data-mode="location">${I18n.t('按地点')}</button>
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary btn-sm" onclick="window.__addEduStage()">＋ ${I18n.t('新增阶段')}</button>
        </div>
      </div>

      <div class="dash-row">
        <div class="card" id="edu-main"></div>
        <div class="card">
          <div class="card-title"><div class="card-title-text">${Util.icon('pie', 'card-title-icon')} ${I18n.t('费用结构')}</div></div>
          <div style="height:280px; position:relative;"><canvas id="edu-pie"></canvas></div>
        </div>
      </div>

      <div class="card" id="edu-linked" style="margin-top:14px;">
        <div class="card-title"><div class="card-title-text">${Util.icon('link','card-title-icon')} ${I18n.t('总表关联记录 · 教育支出')}</div>
          <span class="card-title-sub">${I18n.t('在「记一笔 / 交易」选「教育」分类自动汇总')}</span></div>
        <div id="edu-linked-body"></div>
      </div>
    `;

    bindEvents();
    renderMain(stages);
    renderPie(stages);
    renderLinkedEdu();
  }

  function renderLinkedEdu() {
    const host = document.getElementById('edu-linked-body');
    if (!host) return;
    const root = Data.getCategories().find(c => c.name === '教育' && !c.parent);
    const txs = root ? Data.getTransactions().filter(t => {
      if (!t.categoryId) return false;
      const path = Data.getCategoryPath(t.categoryId);
      return path.length && path[0] && path[0].id === root.id;
    }) : [];
    const total = txs.reduce((s, t) => s + (t.type === 'expense' ? Number(t.amount || 0) : 0), 0);
    const recent = txs.slice().sort((a, b) => b.time - a.time).slice(0, 6);
    if (!txs.length) {
      host.innerHTML = '<div class="empty" style="padding:18px;"><div class="empty-desc">' + I18n.t('还没有「教育」类交易。去「记一笔」选择「教育」分类,记录会自动汇总到这里。') + '</div></div>';
      return;
    }
    // 按子分类聚合(v40+)
    const subMap = {};
    txs.forEach(t => {
      if (t.type !== 'expense') return;
      const path = Data.getCategoryPath(t.categoryId);
      const sub = path[1] ? path[1].name : '其他';
      subMap[sub] = (subMap[sub] || 0) + Number(t.amount || 0);
    });
    const subs = Object.entries(subMap).sort((a, b) => b[1] - a[1]);
    const maxSub = Math.max(...subs.map(s => s[1]), 1);
    host.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-3);">
        <span style="color:var(--text-muted); font-size:13px;">${I18n.t('教育类实际支出合计')}</span>
        <span style="font-weight:800; color:var(--up); font-size:18px;">${Util.fmtMoney(total)}</span>
      </div>
      <div style="padding:12px 14px; display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; border-bottom:1px solid var(--border);">
        ${subs.map(([name, amt]) => `
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
              <span>${Util.escapeHtml(name)}</span><span>${Util.fmtMoneyCompact(amt)}</span>
            </div>
            <div style="height:4px; background:var(--bg-3); border-radius:2px; margin-top:4px; overflow:hidden;">
              <div style="height:100%; background:var(--info); width:${(amt / maxSub * 100).toFixed(1)}%;"></div>
            </div>
          </div>
        `).join('')}
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

  function bindEvents() {
    Util.$$('.tab', document.getElementById('view')).forEach(t => {
      if (!t.dataset.mode) return;
      t.addEventListener('click', () => {
        view_mode = t.dataset.mode;
        render(document.getElementById('view'));
      });
    });
  }

  function renderMain(stages) {
    const main = document.getElementById('edu-main');
    if (!main) return;
    if (!stages.length) {
      main.innerHTML = '<div class="empty"><div class="empty-icon">' + Util.icon('graduation') + '</div><div class="empty-title">' + I18n.t('还没有教育阶段') + '</div><div class="empty-desc">' + I18n.t('点击右上角添加你的求学阶段') + '</div></div>';
      return;
    }

    if (view_mode === 'timeline') {
      main.innerHTML = `
        <div class="card-title"><div class="card-title-text">${I18n.t('时间轴 · 求学历程')}</div></div>
        <div class="edu-timeline">
          ${stages.map(s => `
            <div class="edu-step ${s.current ? 'current' : ''}">
              <div class="edu-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="font-weight:700; font-size:15px;">${Util.escapeHtml(s.stage)}</div>
                  ${s.current ? '<span class="tag tag-warn">' + I18n.t('进行中') + '</span>' : ''}
                </div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                  ${Util.escapeHtml(s.location)} · ${Util.escapeHtml(s.startDate)} ~ ${Util.escapeHtml(s.endDate)}
                </div>
                <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:14px;">
                  <div style="text-align:center;"><div style="font-size:10px;color:var(--text-muted);">${I18n.t('学费')}</div><div style="font-weight:700;color:var(--up);">${Util.fmtMoneyCompact(s.tuition||0)}</div></div>
                  <div style="text-align:center;"><div style="font-size:10px;color:var(--text-muted);">${I18n.t('生活')}</div><div style="font-weight:700;">${Util.fmtMoneyCompact(s.living||0)}</div></div>
                  <div style="text-align:center;"><div style="font-size:10px;color:var(--text-muted);">${I18n.t('教材')}</div><div style="font-weight:700;">${Util.fmtMoneyCompact(s.books||0)}</div></div>
                  <div style="text-align:center;"><div style="font-size:10px;color:var(--text-muted);">${I18n.t('杂费')}</div><div style="font-weight:700;">${Util.fmtMoneyCompact(s.supplies||0)}</div></div>
                </div>
                <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:13px; color:var(--text-muted);">${I18n.t('阶段总投入')}</span>
                  <span style="font-weight:700; font-size:16px;">${Util.fmtMoney(s.total||0)}</span>
                </div>
                <div style="margin-top:10px; display:flex; gap:6px;">
                  <button class="btn btn-ghost btn-sm" onclick="window.__editEduStage('${s.id}')">${I18n.t('编辑')}</button>
                  <button class="btn btn-ghost btn-sm" onclick="window.__deleteEduStage('${s.id}')" style="color:var(--up)">${I18n.t('删除')}</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      // 按地点分组
      const byLoc = {};
      stages.forEach(s => {
        const loc = s.location || I18n.t('未知');
        if (!byLoc[loc]) byLoc[loc] = { stages: [], total: 0 };
        byLoc[loc].stages.push(s);
        byLoc[loc].total += (s.total || 0);
      });
      main.innerHTML = `
        <div class="card-title"><div class="card-title-text">${I18n.t('按地点分组 · 求学花费')}</div></div>
        <div style="display:flex; flex-direction:column; gap:16px;">
          ${Object.entries(byLoc).map(([loc, v]) => `
            <div style="padding:16px; background:var(--bg-3); border-radius:var(--r-md); border:1px solid var(--border);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-weight:700; font-size:15px;">${Util.escapeHtml(loc)}</span>
                <span style="font-weight:700; color:var(--info);">${Util.fmtMoney(v.total)}</span>
              </div>
              ${v.stages.map(s => `
                <div style="display:flex; justify-content:space-between; font-size:13px; padding:6px 0; border-top:1px solid var(--border);">
                  <span>${Util.escapeHtml(s.stage)}</span>
                  <span style="color:var(--text-muted);">${Util.escapeHtml(s.startDate)}~${Util.escapeHtml(s.endDate)}</span>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  let pieChart = null;
  function renderPie(stages) {
    const ctx = document.getElementById('edu-pie');
    if (!ctx) return;
    if (pieChart) pieChart.destroy();
    const ct = Util.chartTheme();
    const data = [
      { label: I18n.t('学费'), value: stages.reduce((s, e) => s + (e.tuition || 0), 0), color: '#5b9bd5' },
      { label: I18n.t('生活'), value: stages.reduce((s, e) => s + (e.living || 0), 0), color: '#2f6cab' },
      { label: I18n.t('教材'), value: stages.reduce((s, e) => s + (e.books || 0), 0), color: '#2f6cab' },
      { label: I18n.t('杂费'), value: stages.reduce((s, e) => s + (e.supplies || 0), 0), color: '#5b9bd5' },
    ];
    const total = data.reduce((s, d) => s + d.value, 0);
    pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => `${d.label} ${((d.value / Math.max(1, total)) * 100).toFixed(0)}%`),
        datasets: [{ data: data.map(d => d.value), backgroundColor: data.map(d => d.color), borderWidth: 2, borderColor: '#ffffff' }],
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

  window.__addEduStage = () => openStageModal(null);
  window.__editEduStage = (id) => openStageModal(id);
  window.__deleteEduStage = async (id) => {
    const s = Data.getEducationStages().find(x => x.id === id);
    if (!s) return;
    const ok = await Util.confirm(I18n.t('删除阶段'), I18n.t('确定删除「{s}」吗?', { s: s.stage }), { okText: I18n.t('是'), cancelText: I18n.t('否'), danger: true });
    if (ok) { Data.deleteEducationStage(id); Util.toast(I18n.t('已删除'), 'success'); render(document.getElementById('view')); }
  };

  function openStageModal(id) {
    const s = id ? Data.getEducationStages().find(x => x.id === id) : null;
    const body = document.createElement('div');

    // 从交易中聚合当前阶段时间窗内的教育类支出(按子分类:学费/书本/生活费/杂费)
    function computeLinkedTotals(start, end) {
      const root = Data.getCategories().find(c => c.name === '教育' && !c.parent);
      if (!root) return { tuition: 0, books: 0, living: 0, supplies: 0, counts: {} };
      const sMs = start ? new Date(start + '-01').getTime() : -Infinity;
      const eMs = end ? new Date(end + '-01').getTime() + 31 * 86400000 : Infinity;
      const txs = Data.getTransactions().filter(t => {
        if (t.type !== 'expense' || !t.categoryId) return false;
        if (t.time < sMs || t.time >= eMs) return false;
        const path = Data.getCategoryPath(t.categoryId);
        return path.length && path[0] && path[0].id === root.id;
      });
      const sums = { tuition: 0, books: 0, living: 0, supplies: 0 };
      const counts = { tuition: 0, books: 0, living: 0, supplies: 0 };
      txs.forEach(t => {
        const path = Data.getCategoryPath(t.categoryId);
        const sub = path[1] && path[1].name;
        if (sub === '学费') { sums.tuition += Number(t.amount || 0); counts.tuition++; }
        else if (sub === '书本') { sums.books += Number(t.amount || 0); counts.books++; }
        else if (sub === '生活费') { sums.living += Number(t.amount || 0); counts.living++; }
        else if (sub === '杂费') { sums.supplies += Number(t.amount || 0); counts.supplies++; }
      });
      return Object.assign({}, sums, { counts });
    }
    const initialLinked = computeLinkedTotals(s?.startDate, s?.endDate);
    const manualFlags = { tuition: false, living: false, books: false, supplies: false };

    body.innerHTML = `
      <div class="form-group"><label>${I18n.t('阶段名称')}</label><input type="text" class="input" id="e-stage" value="${Util.escapeHtml(s?.stage || '')}" placeholder="${I18n.t('如: 本科 · 中国传媒大学')}" /></div>
      <div class="form-group"><label>${I18n.t('地点')}</label>
        <div class="region-field" id="e-loc-wrap">
          <svg class="rf-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
          <input type="text" class="input rf-input" id="e-loc" value="${Util.escapeHtml(s?.location || '')}" placeholder="${I18n.t('省 / 市 / 区 — 点击选择')}" readonly />
          <button type="button" class="rf-clear" id="e-loc-clear" title="${I18n.t('清除')}" aria-label="清除">✕</button>
        </div>
        <input type="hidden" id="e-lat" value="${s?.lat ?? ''}" />
        <input type="hidden" id="e-lng" value="${s?.lng ?? ''}" />
      </div>
      <div class="split-2">
        <div class="form-group"><label>${I18n.t('开始')}</label><input type="month" class="input" id="e-start" value="${s?.startDate || ''}" /></div>
        <div class="form-group"><label>${I18n.t('结束')}</label><input type="month" class="input" id="e-end" value="${s?.endDate || ''}" /></div>
      </div>
      <div style="background:var(--bg-3); border:1px solid var(--border); border-radius:var(--r-md); padding:10px 12px; margin:6px 0 12px; font-size:12px; color:var(--text-muted);">
        💡 <b>自动同步:</b>下方 4 项金额默认为当前时间窗内「教育/学费/书本/生活费/杂费」分类的实际交易汇总。修改时间或勾选「手动调整」可覆盖。
      </div>
      <div class="split-2">
        <div class="form-group">
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>${I18n.t('学费')}</span>
            <label style="font-size:11px; color:var(--text-muted);"><input type="checkbox" class="e-manual" data-field="tuition" ${s?.manual?.tuition ? 'checked' : ''}/> ${I18n.t('手动')}</label>
          </label>
          <input type="number" step="0.01" class="input e-amount" data-field="tuition" id="e-tuition" value="${s?.tuition ?? initialLinked.tuition}" readonly />
          <small class="edu-auto-hint" data-field="tuition" style="color:var(--text-muted);">来源 ${initialLinked.counts.tuition} 笔教育/学费交易</small>
        </div>
        <div class="form-group">
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>${I18n.t('生活费')}</span>
            <label style="font-size:11px; color:var(--text-muted);"><input type="checkbox" class="e-manual" data-field="living" ${s?.manual?.living ? 'checked' : ''}/> ${I18n.t('手动')}</label>
          </label>
          <input type="number" step="0.01" class="input e-amount" data-field="living" id="e-living" value="${s?.living ?? initialLinked.living}" readonly />
          <small class="edu-auto-hint" data-field="living" style="color:var(--text-muted);">来源 ${initialLinked.counts.living} 笔教育/生活费交易</small>
        </div>
      </div>
      <div class="split-2">
        <div class="form-group">
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>${I18n.t('教材费')}</span>
            <label style="font-size:11px; color:var(--text-muted);"><input type="checkbox" class="e-manual" data-field="books" ${s?.manual?.books ? 'checked' : ''}/> ${I18n.t('手动')}</label>
          </label>
          <input type="number" step="0.01" class="input e-amount" data-field="books" id="e-books" value="${s?.books ?? initialLinked.books}" readonly />
          <small class="edu-auto-hint" data-field="books" style="color:var(--text-muted);">来源 ${initialLinked.counts.books} 笔教育/书本交易</small>
        </div>
        <div class="form-group">
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>${I18n.t('杂费')}</span>
            <label style="font-size:11px; color:var(--text-muted);"><input type="checkbox" class="e-manual" data-field="supplies" ${s?.manual?.supplies ? 'checked' : ''}/> ${I18n.t('手动')}</label>
          </label>
          <input type="number" step="0.01" class="input e-amount" data-field="supplies" id="e-supplies" value="${s?.supplies ?? initialLinked.supplies}" readonly />
          <small class="edu-auto-hint" data-field="supplies" style="color:var(--text-muted);">来源 ${initialLinked.counts.supplies} 笔教育/杂费交易</small>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; padding:8px 4px; border-top:1px solid var(--border); margin-top:6px; font-size:13px;">
        <span style="color:var(--text-muted);">${I18n.t('阶段总投入')}</span>
        <b id="e-total" style="font-size:16px;">¥0.00</b>
      </div>
      <label style="display:flex; gap:8px; align-items:center; font-size:13px; color:var(--text-muted); margin-top:6px;"><input type="checkbox" id="e-current" ${s?.current ? 'checked' : ''} /> ${I18n.t('标记为当前进行中')}</label>
    `;
    Util.modal({
      title: s ? I18n.t('编辑阶段') : I18n.t('新增求学阶段'),
      body,
      footer: `<button class="btn btn-ghost" data-act="close">${I18n.t('取消')}</button><button class="btn btn-primary" id="e-save">${I18n.t('保存')}</button>`,
    });

    const startEl = document.getElementById('e-start');
    const endEl = document.getElementById('e-end');
    const totalEl = document.getElementById('e-total');
    function refreshAuto() {
      const linked = computeLinkedTotals(startEl.value, endEl.value);
      ['tuition', 'living', 'books', 'supplies'].forEach(f => {
        const inp = document.getElementById('e-' + f);
        const hint = body.querySelector('.edu-auto-hint[data-field="' + f + '"]');
        if (!inp) return;
        if (!manualFlags[f] && inp.hasAttribute('readonly')) {
          inp.value = linked[f].toFixed(2);
        }
        if (hint) hint.textContent = `来源 ${linked.counts[f]} 笔教育/${f === 'books' ? '书本' : f === 'living' ? '生活费' : f}交易`;
      });
      updateTotal();
    }
    function updateTotal() {
      const t = parseFloat(document.getElementById('e-tuition').value) || 0;
      const l = parseFloat(document.getElementById('e-living').value) || 0;
      const b = parseFloat(document.getElementById('e-books').value) || 0;
      const s2 = parseFloat(document.getElementById('e-supplies').value) || 0;
      if (totalEl) totalEl.textContent = Util.fmtMoney(t + l + b + s2);
    }
    startEl.addEventListener('change', refreshAuto);
    endEl.addEventListener('change', refreshAuto);
    body.querySelectorAll('.e-manual').forEach(cb => {
      cb.addEventListener('change', () => {
        const f = cb.dataset.field;
        manualFlags[f] = cb.checked;
        const inp = document.getElementById('e-' + f);
        if (cb.checked) { inp.removeAttribute('readonly'); inp.style.background = '#fff'; }
        else { inp.setAttribute('readonly', ''); refreshAuto(); }
      });
      if (cb.checked) {
        const f = cb.dataset.field;
        manualFlags[f] = true;
        const inp = document.getElementById('e-' + f);
        if (inp) { inp.removeAttribute('readonly'); inp.style.background = '#fff'; }
      }
    });
    body.querySelectorAll('.e-amount').forEach(inp => inp.addEventListener('input', updateTotal));
    updateTotal();

    // 省/市/区 级联选择(替代地图选点)
    const eLocWrap = document.getElementById('e-loc-wrap');
    const eLocInput = document.getElementById('e-loc');
    const openRegionPick = () => {
      if (window.RegionPicker) RegionPicker.open({ trigger: eLocInput, value: eLocInput.value, onSelect: (addr) => { eLocInput.value = addr; } });
    };
    if (eLocWrap) eLocWrap.addEventListener('click', (e) => { if (e.target.id !== 'e-loc-clear') openRegionPick(); });
    const eLocClear = document.getElementById('e-loc-clear');
    if (eLocClear) eLocClear.addEventListener('click', (e) => { e.stopPropagation(); eLocInput.value = ''; });

    document.getElementById('e-save').addEventListener('click', () => {
      const stage = document.getElementById('e-stage').value.trim();
      if (!stage) { Util.toast(I18n.t('请输入阶段名称'), 'warn'); return; }
      const tuition = parseFloat(document.getElementById('e-tuition').value) || 0;
      const living = parseFloat(document.getElementById('e-living').value) || 0;
      const books = parseFloat(document.getElementById('e-books').value) || 0;
      const supplies = parseFloat(document.getElementById('e-supplies').value) || 0;
      const lat = parseFloat(document.getElementById('e-lat').value);
      const lng = parseFloat(document.getElementById('e-lng').value);
      const patch = {
        stage,
        location: document.getElementById('e-loc').value.trim(),
        startDate: startEl.value,
        endDate: endEl.value,
        tuition, living, books, supplies,
        total: tuition + living + books + supplies,
        current: document.getElementById('e-current').checked,
        lat: isNaN(lat) ? null : lat,
        lng: isNaN(lng) ? null : lng,
        manual: Object.assign({}, manualFlags),
      };
      if (patch.current) Data.getEducationStages().forEach(x => { if (x.id !== id) x.current = false; });
      if (s) Data.updateEducationStage(id, patch);
      else Data.addEducationStage(patch);
      Util.toast(I18n.t('已保存'), 'success');
      document.querySelector('.modal-mask')?.remove();
      render(document.getElementById('view'));
    });
  }

  return { render };
})();
