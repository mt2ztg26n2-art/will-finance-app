/* =========================================================
   views/audit.js — 痕迹日志视图 v40+
   - 渲染 Data.getLogs() 的全部痕迹
   - 顶部筛选:类型(全部/tx/budget/.../rule/settings) + 时间范围
   - 每行:时间 · 类型chip · 动作 · 目标 · 摘要
   ========================================================= */
const AuditView = (() => {
  const TYPE_META = {
    system:    { label: '系统',   color: 'var(--text-muted)' },
    tx:        { label: '交易',   color: 'var(--brand)' },
    budget:    { label: '预算',   color: 'var(--warn)' },
    account:   { label: '账户',   color: 'var(--info)' },
    pot:       { label: '存钱罐', color: '#ff7d00' },
    liability: { label: '负债',   color: '#ff4d4f' },
    education: { label: '教育',   color: '#00b96b' },
    rule:      { label: '规则',   color: '#2f54eb' },
    settings:  { label: '设置',   color: 'var(--text-muted)' },
  };
  const ACTION_LABEL = {
    create: '新增', update: '更新', delete: '删除',
    login: '登录', sync: '同步', unknown: '操作',
  };
  function fmtTime(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function render(root) {
    if (!root) return;
    const allLogs = Data.getLogs();
    const types = Object.keys(TYPE_META);
    root.innerHTML = `
      <div class="page-header">
        <div class="page-header-ico" style="background: var(--brand-soft); color: var(--brand);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <div class="page-header-text">
          <h1 data-i18n="痕迹日志">痕迹日志</h1>
          <p>共 ${allLogs.length} 条操作记录,所有账户/交易/预算/存钱罐/负债/教育/规则的 CUD 都会自动留痕。</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-ghost" id="audit-clear">🗑 清空全部</button>
        </div>
      </div>

      <div class="card">
        <div class="audit-filters">
          <label>类型
            <select class="input" id="audit-type">
              <option value="">全部</option>
              ${types.map(t => `<option value="${t}">${TYPE_META[t].label}</option>`).join('')}
            </select>
          </label>
          <label>从 <input type="date" class="input" id="audit-from" /></label>
          <label>至 <input type="date" class="input" id="audit-to" /></label>
          <button class="btn btn-ghost" id="audit-reset">重置</button>
        </div>
      </div>

      <div class="card" style="padding:0;">
        <div class="audit-list" id="audit-list"></div>
      </div>
    `;
    const listEl = root.querySelector('#audit-list');
    const typeSel = root.querySelector('#audit-type');
    const fromEl = root.querySelector('#audit-from');
    const toEl = root.querySelector('#audit-to');

    function paint() {
      const t = typeSel.value;
      const f = fromEl.value ? new Date(fromEl.value).getTime() : null;
      const u = toEl.value ? new Date(toEl.value).getTime() + 86399999 : null;
      const filtered = Data.getLogs({ type: t || undefined, since: f || undefined, until: u || undefined });
      if (!filtered.length) {
        listEl.innerHTML = `<div class="audit-empty">还没有任何操作记录<br/><small>开始记账、设置预算或管理存钱罐,这里就会自动生成痕迹。</small></div>`;
        return;
      }
      listEl.innerHTML = filtered.map(e => {
        const meta = TYPE_META[e.type] || TYPE_META.system;
        const action = ACTION_LABEL[e.action] || e.action;
        return `
          <div class="audit-row">
            <span class="audit-time">${fmtTime(e.time)}</span>
            <span class="audit-chip" style="color:${meta.color}; background: ${meta.color}1a;">${meta.label}</span>
            <span class="audit-action">${action}</span>
            <span class="audit-target">${(e.target || '').replace(/</g, '&lt;')}</span>
            <span class="audit-summary">${(e.summary || '').replace(/</g, '&lt;')}</span>
          </div>
        `;
      }).join('');
    }

    typeSel.addEventListener('change', paint);
    fromEl.addEventListener('change', paint);
    toEl.addEventListener('change', paint);
    root.querySelector('#audit-reset').addEventListener('click', () => {
      typeSel.value = ''; fromEl.value = ''; toEl.value = ''; paint();
    });
    root.querySelector('#audit-clear').addEventListener('click', () => {
      Util.confirm('清空痕迹日志', '此操作不可撤销,确定清空全部痕迹日志?', { okText: '清空', danger: true })
        .then(ok => {
          if (!ok) return;
          Data.clearLogs();
          Util.toast('已清空痕迹日志', 'success');
          paint();
        });
    });
    paint();
  }

  return { render };
})();
