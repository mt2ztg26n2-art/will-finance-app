/* =========================================================
   View: 存钱罐 / 小荷包（自定义存钱：活期 / 定期 / 死期 / 小荷包）
   + 自动攒钱计划（每日/每周/每月自动扣款）
   ========================================================= */

const POT_TYPES = {
  huoqi: { key: '活期', descKey: '随时存取，灵活机动', icon: 'banknote', color: '#13c2c2' },
  dingqi: { key: '定期', descKey: '固定期限，约定利率', icon: 'landmark', color: '#0f5132' },
  siqi: { key: '死期', descKey: '整存整取，到期支取', icon: 'lock', color: '#9254de' },
  xiaohebao: { key: '小荷包', descKey: '自定义攒钱罐，可自动攒', icon: 'wallet', color: '#ff7d00' },
};
function potTypeName(t) { return I18n.t((POT_TYPES[t] || POT_TYPES.xiaohebao).key); }
function potTypeDesc(t) { return I18n.t((POT_TYPES[t] || POT_TYPES.xiaohebao).descKey); }

const PotsView = (() => {
  const fmt = (n) => Util.fmtMoney(n);
  const icon = (n) => Util.icon(n);

  function render(view) {
    const pots = Data.getPots();
    const rules = Data.getRules();
    const totalSaved = pots.reduce((s, p) => s + Number(p.balance || 0), 0);
    const activeRules = rules.filter(r => r.active).length;
    const monthlyAuto = rules.filter(r => r.active).reduce((s, r) =>
      s + (r.freq === 'daily' ? r.amount * 30 : r.freq === 'weekly' ? r.amount * 4 : r.amount), 0);
    const liquid = pots.filter(p => p.type === 'huoqi' || p.type === 'xiaohebao')
      .reduce((s, p) => s + Number(p.balance || 0), 0);
    const fixed = pots.filter(p => p.type === 'dingqi' || p.type === 'siqi').length;

    view.innerHTML = `
      <div class="print-toolbar no-print">
        <button class="btn btn-primary" onclick="PotsView.addPot()">${icon('plus')} ${I18n.t('新建存钱罐')}</button>
        <button class="btn btn-ghost" onclick="PotsView.addRule()">${icon('refresh-cw')} ${I18n.t('新建自动攒钱')}</button>
      </div>

      <div class="asset-board">
        <div class="ab-tile" style="--ab-color:#ff7d00;--ab-soft:rgba(255,125,0,.12)">
          <div class="ab-ico">${icon('wallet')}</div>
          <div class="ab-label">${I18n.t('已攒总额')}</div>
          <div class="ab-value">${fmt(totalSaved)}</div>
          <div class="ab-sub">${I18n.t('{n} 个存钱罐', { n: pots.length })}</div>
        </div>
        <div class="ab-tile" style="--ab-color:#0f5132;--ab-soft:rgba(15,81,50,.10)">
          <div class="ab-ico">${icon('refresh-cw')}</div>
          <div class="ab-label">${I18n.t('自动攒钱计划')}</div>
          <div class="ab-value">${activeRules}</div>
          <div class="ab-sub">${I18n.t('每月约自动攒 {a}', { a: fmt(monthlyAuto) })}</div>
        </div>
        <div class="ab-tile" style="--ab-color:#00b96b;--ab-soft:rgba(0,185,107,.12)">
          <div class="ab-ico">${icon('arrow-down')}</div>
          <div class="ab-label">${I18n.t('小荷包示例')}</div>
          <div class="ab-value">¥10/${I18n.t('天')}</div>
          <div class="ab-sub">${I18n.t('每天自动扣款')}</div>
        </div>
        <div class="ab-tile" style="--ab-color:#9254de;--ab-soft:rgba(146,84,222,.12)">
          <div class="ab-ico">${icon('landmark')}</div>
          <div class="ab-label">${I18n.t('定期 / 死期')}</div>
          <div class="ab-value">${fixed}</div>
          <div class="ab-sub">${I18n.t('锁定增值中')}</div>
        </div>
        <div class="ab-tile" style="--ab-color:#13c2c2;--ab-soft:rgba(19,194,194,.12)">
          <div class="ab-ico">${icon('banknote')}</div>
          <div class="ab-label">${I18n.t('活期可动用')}</div>
          <div class="ab-value">${fmt(liquid)}</div>
          <div class="ab-sub">${I18n.t('随时存取')}</div>
        </div>
      </div>

      <div class="section-head"><h3>${I18n.t('我的存钱罐')}</h3></div>
      <div class="pot-grid" id="pot-grid">
        ${pots.length ? pots.map(potCard).join('') : `<div class="empty"><div class="empty-desc">${I18n.t('还没有存钱罐，点上方「新建存钱罐」开始攒钱')}</div></div>`}
      </div>

      <div class="section-head" style="margin-top:18px;"><h3>${I18n.t('自动攒钱计划')}</h3>
        <button class="btn btn-ghost btn-sm" onclick="PotsView.addRule()">${icon('plus')} ${I18n.t('新建')}</button>
      </div>
      <div class="rule-list">
        ${rules.length ? rules.map(ruleRow).join('') : `<div class="empty"><div class="empty-desc">${I18n.t('还没有自动攒钱计划。例如：每天从银行卡扣 10 元存入小荷包。')}</div></div>`}
      </div>
    `;
  }

  function potCard(p) {
    const meta = POT_TYPES[p.type] || POT_TYPES.xiaohebao;
    const pct = p.target ? Math.min(100, (Number(p.balance) / Number(p.target)) * 100) : null;
    const sub = p.target
      ? I18n.t('目标 {t}', { t: fmt(p.target) })
      : (p.rate ? I18n.t('年利率 {r}%', { r: p.rate }) : I18n.t('活期攒钱'));
    return `
      <div class="pot-card">
        <div class="pot-card-top">
          <div class="pot-ico" style="background:${p.color || meta.color}">${icon(meta.icon)}</div>
          <div>
            <div class="pot-name">${Util.escapeHtml(p.name)}</div>
            <span class="pot-type-tag" style="color:${p.color || meta.color};background:${(p.color||meta.color)+'1a'}">${potTypeName(p.type)}</span>
          </div>
        </div>
        <div class="pot-balance">${fmt(p.balance)}</div>
        <div class="pot-target">${sub}</div>
        ${pct !== null ? `<div class="pot-progress"><span style="width:${pct}%;background:${p.color || meta.color}"></span></div>` : ''}
        <div class="pot-meta">
          ${p.rate ? `<div>${I18n.t('利率 {r}%', { r: p.rate })}</div>` : ''}
          ${p.termMonths ? `<div>${I18n.t('期限 {b} 月', { b: p.termMonths })}</div>` : ''}
          ${p.locked ? `<div><b style="color:var(--down)">${I18n.t('到期支取')}</b></div>` : ''}
        </div>
        <div class="pot-actions">
          <button class="pot-action" onclick="PotsView.deposit('${p.id}')">${icon('arrow-down')} ${I18n.t('存入')}</button>
          <button class="pot-action" onclick="PotsView.withdraw('${p.id}')">${icon('arrow-up')} ${I18n.t('取出')}</button>
          <button class="pot-action" onclick="PotsView.editPot('${p.id}')">${icon('pen')} ${I18n.t('编辑')}</button>
          <button class="pot-action danger" onclick="PotsView.removePot('${p.id}')">${icon('trash')} ${I18n.t('删除')}</button>
        </div>
      </div>`;
  }

  function ruleRow(r) {
    const from = Data.getAccount(r.fromAccountId);
    const toName = r.toType === 'pot'
      ? (Data.getPot(r.toPotId) || {}).name
      : (Data.getAccount(r.toAccountId) || {}).name;
    const freqLabel = ({ daily: I18n.t('每天'), weekly: I18n.t('每周'), monthly: I18n.t('每月') })[r.freq] || r.freq;
    const unit = r.freq === 'daily' ? I18n.t('天') : r.freq === 'weekly' ? I18n.t('周') : I18n.t('月');
    return `
      <div class="rule-item ${r.active ? '' : 'off'}">
        <div class="rule-ico">${icon('refresh-cw')}</div>
        <div class="rule-body">
          <div class="rule-title">${Util.escapeHtml(r.name)}</div>
          <div class="rule-sub">${freqLabel} · ${I18n.t('从')} <b>${from ? Util.escapeHtml(from.name) : I18n.t('已删除账户')}</b> ${I18n.t('自动')}${r.toType === 'pot' ? I18n.t('存入') : I18n.t('转至')} <b>${Util.escapeHtml(toName || '—')}</b></div>
        </div>
        <div class="rule-amount">${fmt(r.amount)}<small> /${unit}</small></div>
        <button class="pot-action" style="flex:0 0 auto" onclick="PotsView.toggleRule('${r.id}')">${r.active ? I18n.t('暂停') : I18n.t('启用')}</button>
        <button class="rule-del" onclick="PotsView.removeRule('${r.id}')" title="${I18n.t('删除')}">${icon('trash')}</button>
      </div>`;
  }

  // ---------- 新建 / 编辑存钱罐 ----------
  function addPot() { openPotModal(null); }
  function editPot(id) {
    const p = Data.getPot(id);
    if (p) openPotModal(p);
  }

  function openPotModal(pot) {
    const isEdit = !!pot;
    const p = pot || { type: 'xiaohebao', color: POT_TYPES.xiaohebao.color, balance: 0 };
    const typeOptions = Object.keys(POT_TYPES).map(t => {
      const m = POT_TYPES[t];
      const sel = t === p.type ? 'active' : '';
      return `<div class="pot-type-opt ${sel}" data-type="${t}">
        <div class="pt-ico" style="background:${m.color}">${icon(m.icon)}</div>
        <div><div class="pt-name">${potTypeName(t)}</div><div class="pt-desc">${potTypeDesc(t)}</div></div>
      </div>`;
    }).join('');

    const body = document.createElement('div');
    body.innerHTML = `
      <div class="form-group"><label>${I18n.t('存钱罐名称')}</label>
        <input class="input" id="pot-name" value="${Util.escapeHtml(p.name || '')}" placeholder="${I18n.t('如：支付宝小荷包')}" /></div>
      <div class="form-group"><label>${I18n.t('类型')}</label>
        <div class="pot-type-pick" id="pot-type">${typeOptions}</div></div>
      <div class="form-grid">
        <div class="form-group"><label>${I18n.t('当前余额 (¥)')}</label>
          <input class="input" id="pot-balance" type="number" min="0" step="0.01" value="${Number(p.balance || 0)}" /></div>
        <div class="form-group"><label>${I18n.t('目标金额 (¥，可选)')}</label>
          <input class="input" id="pot-target" type="number" min="0" step="0.01" value="${p.target || ''}" placeholder="3650" /></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>${I18n.t('年利率 % (定期/死期)')}</label>
          <input class="input" id="pot-rate" type="number" min="0" step="0.01" value="${p.rate || ''}" placeholder="1.8" /></div>
        <div class="form-group"><label>${I18n.t('期限 (月，定期/死期)')}</label>
          <input class="input" id="pot-term" type="number" min="1" step="1" value="${p.termMonths || ''}" placeholder="12" /></div>
      </div>
      <div class="form-group"><label>${I18n.t('备注')}</label>
        <input class="input" id="pot-note" value="${Util.escapeHtml(p.note || '')}" placeholder="${I18n.t('选填')}" /></div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-2);cursor:pointer;">
        <input type="checkbox" id="pot-locked" ${p.locked ? 'checked' : ''}/> ${I18n.t('死期锁定（仅到期可取出）')}
      </label>
    `;

    Util.modal({
      title: isEdit ? I18n.t('编辑存钱罐') : I18n.t('新建存钱罐'),
      body,
      footer: `<button class="btn btn-ghost" data-act="close">${I18n.t('取消')}</button><button class="btn btn-primary" id="pot-save">${I18n.t('保存')}</button>`,
    });

    let chosenType = p.type;
    body.querySelectorAll('.pot-type-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        body.querySelectorAll('.pot-type-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        chosenType = opt.dataset.type;
      });
    });

    document.getElementById('pot-save').addEventListener('click', () => {
      const name = document.getElementById('pot-name').value.trim();
      if (!name) { Util.toast(I18n.t('请填写名称'), 'warn'); return; }
      const payload = {
        name,
        type: chosenType,
        color: POT_TYPES[chosenType].color,
        balance: Number(document.getElementById('pot-balance').value || 0),
        target: Number(document.getElementById('pot-target').value || 0) || null,
        rate: Number(document.getElementById('pot-rate').value || 0) || null,
        termMonths: Number(document.getElementById('pot-term').value || 0) || null,
        locked: chosenType === 'siqi' ? document.getElementById('pot-locked').checked : false,
        note: document.getElementById('pot-note').value.trim(),
      };
      if (isEdit) { Data.updatePot(pot.id, payload); Util.toast(I18n.t('已更新'), 'success'); }
      else { Data.addPot(payload); Util.toast(I18n.t('存钱罐已创建'), 'success'); }
      document.querySelector('.modal-mask')?.remove();
      Router.handle();
    });
  }

  // ---------- 存入 / 取出（与账户联动同步） ----------
  function deposit(id) { openTransferModal(id, 'deposit'); }
  function withdraw(id) { openTransferModal(id, 'withdraw'); }

  function openTransferModal(potId, mode) {
    const pot = Data.getPot(potId);
    if (!pot) return;
    const accounts = Data.getAccounts();
    const verb = mode === 'deposit' ? I18n.t('存入') : I18n.t('取出');
    const opts = accounts.map(a => `<option value="${a.id}">${Util.escapeHtml(a.name)} (${fmt(a.balance)})</option>`).join('');
    const body = document.createElement('div');
    body.innerHTML = `
      <p style="margin:0 0 12px;color:var(--text-2);font-size:13px;">
        ${verb} <b>${Util.escapeHtml(pot.name)}</b>（${I18n.t('当前 {bal}，将自动与账户余额同步。', { bal: fmt(pot.balance) })}）
      </p>
      <div class="form-grid">
        <div class="form-group"><label>${I18n.t('金额 (¥)')}</label>
          <input class="input" id="tr-amount" type="number" min="0.01" step="0.01" placeholder="0.00" /></div>
        <div class="form-group"><label>${mode === 'deposit' ? I18n.t('从账户扣款') : I18n.t('存入账户')}</label>
          <select class="input" id="tr-account">${opts}</select></div>
      </div>
      <div class="form-group"><label>${I18n.t('备注')}</label>
        <input class="input" id="tr-note" placeholder="${I18n.t('选填')}" /></div>
    `;
    Util.modal({
      title: `${verb} · ${Util.escapeHtml(pot.name)}`,
      body,
      footer: `<button class="btn btn-ghost" data-act="close">${I18n.t('取消')}</button><button class="btn btn-primary" id="tr-save">${verb}</button>`,
    });
    document.getElementById('tr-save').addEventListener('click', () => {
      const amount = Number(document.getElementById('tr-amount').value || 0);
      const accId = document.getElementById('tr-account').value;
      const note = document.getElementById('tr-note').value.trim();
      if (!(amount > 0)) { Util.toast(I18n.t('请输入正确金额'), 'warn'); return; }
      if (mode === 'withdraw' && pot.locked) {
        return Util.confirm(I18n.t('死期锁定'), I18n.t('该存钱罐为到期支取（死期），现在取出将提前支取，确定继续?')).then(ok => {
          if (ok) doTransfer(pot, mode, amount, accId, note);
        });
      }
      doTransfer(pot, mode, amount, accId, note);
    });
  }

  function doTransfer(pot, mode, amount, accId, note) {
    const acc = Data.getAccount(accId);
    if (mode === 'deposit') {
      Data.addTransaction({
        type: 'expense', amount, accountId: accId,
        categoryId: (Data.getCategories('expense').find(c => c.name === '自动攒钱') || {}).id || null,
        payee: pot.name, description: I18n.t('存入') + ' ' + pot.name + (note ? ' · ' + note : ''),
      });
      Data.updatePot(pot.id, { balance: Math.round((Number(pot.balance) + amount) * 100) / 100 });
      Util.toast(I18n.t('已存入 {a} 到 {n}', { a: fmt(amount), n: Util.escapeHtml(pot.name) }), 'success');
    } else {
      if (Number(pot.balance) < amount) { Util.toast(I18n.t('存钱罐余额不足'), 'error'); return; }
      Data.addTransaction({
        type: 'income', amount, accountId: accId,
        categoryId: (Data.getCategories('income').find(c => c.name === '父母生活费') || {}).id || null,
        payee: pot.name, description: I18n.t('取出') + ' ' + pot.name + (note ? ' · ' + note : ''),
      });
      Data.updatePot(pot.id, { balance: Math.round((Number(pot.balance) - amount) * 100) / 100 });
      Util.toast(I18n.t('已从 {n} 取出 {a}', { n: Util.escapeHtml(pot.name), a: fmt(amount) }), 'success');
    }
    document.querySelector('.modal-mask')?.remove();
    Router.handle();
  }

  function removePot(id) {
    const pot = Data.getPot(id);
    if (!pot) return;
    Util.confirm(I18n.t('删除存钱罐'), I18n.t('确定删除「{n}」?关联自动攒钱计划也会一并移除。', { n: pot.name }), { okText: I18n.t('是'), cancelText: I18n.t('否'), danger: true }).then(ok => {
      if (ok) { Data.deletePot(id); Util.toast(I18n.t('已删除'), 'success'); Router.handle(); }
    });
  }

  // ---------- 自动攒钱规则 ----------
  function addRule() { openRuleModal(null); }

  function computeNextRun(freq, dayOfWeek, dayOfMonth) {
    const now = new Date();
    if (freq === 'daily') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); }
    if (freq === 'weekly') {
      const target = (typeof dayOfWeek === 'number') ? dayOfWeek : now.getDay();
      const d = new Date(now); d.setHours(0, 0, 0, 0);
      let guard = 0;
      while (d.getDay() !== target && guard < 8) { d.setDate(d.getDate() + 1); guard++; }
      return d.getTime();
    }
    if (freq === 'monthly') {
      const day = (typeof dayOfMonth === 'number') ? dayOfMonth : now.getDate();
      const d = new Date(now.getFullYear(), now.getMonth(), 1); d.setHours(0, 0, 0, 0);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last));
      if (d.getTime() <= Date.now()) d.setMonth(d.getMonth() + 1);
      return d.getTime();
    }
    return Date.now();
  }

  function openRuleModal(rule) {
    const isEdit = !!rule;
    const r = rule || { freq: 'daily', toType: 'pot', amount: 10 };
    const accounts = Data.getAccounts();
    const pots = Data.getPots();
    const accOpts = accounts.map(a => `<option value="${a.id}" ${a.id === r.fromAccountId ? 'selected' : ''}>${Util.escapeHtml(a.name)}</option>`).join('');
    const potOpts = pots.map(p => `<option value="${p.id}" ${p.id === r.toPotId ? 'selected' : ''}>${Util.escapeHtml(p.name)}</option>`).join('') || `<option value="">${I18n.t('（暂无存钱罐）')}</option>`;
    const accToOpts = accounts.map(a => `<option value="${a.id}" ${a.id === r.toAccountId ? 'selected' : ''}>${Util.escapeHtml(a.name)}</option>`).join('');

    const body = document.createElement('div');
    body.innerHTML = `
      <div class="form-group"><label>${I18n.t('计划名称')}</label>
        <input class="input" id="r-name" value="${Util.escapeHtml(r.name || I18n.t('每天向小荷包存 10 元'))}" /></div>
      <div class="form-group"><label>${I18n.t('扣款账户')}</label>
        <select class="input" id="r-from">${accOpts}</select></div>
      <div class="form-grid">
        <div class="form-group"><label>${I18n.t('频率')}</label>
          <select class="input" id="r-freq">
            <option value="daily" ${r.freq === 'daily' ? 'selected' : ''}>${I18n.t('每天')}</option>
            <option value="weekly" ${r.freq === 'weekly' ? 'selected' : ''}>${I18n.t('每周')}</option>
            <option value="monthly" ${r.freq === 'monthly' ? 'selected' : ''}>${I18n.t('每月')}</option>
          </select></div>
        <div class="form-group"><label>${I18n.t('金额 (¥)')}</label>
          <input class="input" id="r-amount" type="number" min="0.01" step="0.01" value="${r.amount || 10}" /></div>
      </div>
      <div class="form-group"><label>${I18n.t('转入目标')}</label>
        <select class="input" id="r-totype">
          <option value="pot" ${r.toType !== 'account' ? 'selected' : ''}>${I18n.t('存入存钱罐')}</option>
          <option value="account" ${r.toType === 'account' ? 'selected' : ''}>${I18n.t('转入其他账户')}</option>
        </select></div>
      <div class="form-group" id="r-pot-wrap" style="${r.toType === 'account' ? 'display:none' : ''}">
        <label>${I18n.t('目标存钱罐')}</label>
        <select class="input" id="r-pot">${potOpts}</select>
      </div>
      <div class="form-group" id="r-acc-wrap" style="${r.toType === 'account' ? '' : 'display:none'}">
        <label>${I18n.t('目标账户')}</label>
        <select class="input" id="r-acc">${accToOpts}</select>
      </div>
    `;
    Util.modal({
      title: isEdit ? I18n.t('编辑自动攒钱') : I18n.t('新建自动攒钱计划'),
      body,
      footer: `<button class="btn btn-ghost" data-act="close">${I18n.t('取消')}</button><button class="btn btn-primary" id="r-save">${I18n.t('保存')}</button>`,
    });

    const freqSel = document.getElementById('r-freq');
    const totypeSel = document.getElementById('r-totype');
    freqSel.addEventListener('change', () => {});
    totypeSel.addEventListener('change', () => {
      const toAcc = totypeSel.value === 'account';
      document.getElementById('r-pot-wrap').style.display = toAcc ? 'none' : '';
      document.getElementById('r-acc-wrap').style.display = toAcc ? '' : 'none';
    });

    document.getElementById('r-save').addEventListener('click', () => {
      const name = document.getElementById('r-name').value.trim();
      const fromAccountId = document.getElementById('r-from').value;
      const freq = document.getElementById('r-freq').value;
      const amount = Number(document.getElementById('r-amount').value || 0);
      const toType = document.getElementById('r-totype').value;
      if (!name) { Util.toast(I18n.t('请填写名称'), 'warn'); return; }
      if (!(amount > 0)) { Util.toast(I18n.t('金额不正确'), 'warn'); return; }
      const payload = {
        name, fromAccountId, freq, amount,
        toType,
        toPotId: toType === 'pot' ? document.getElementById('r-pot').value : null,
        toAccountId: toType === 'account' ? document.getElementById('r-acc').value : null,
        active: isEdit ? rule.active : true,
        nextRun: isEdit ? rule.nextRun : computeNextRun(freq, null, null),
        lastRun: isEdit ? rule.lastRun : null,
      };
      if (isEdit) { Data.updateRule(rule.id, payload); Util.toast(I18n.t('已更新'), 'success'); }
      else { Data.addRule(payload); Util.toast(I18n.t('自动攒钱计划已创建'), 'success'); }
      document.querySelector('.modal-mask')?.remove();
      Router.handle();
    });
  }

  function toggleRule(id) {
    const r = Data.getRule(id);
    if (!r) return;
    Data.updateRule(id, { active: !r.active });
    Router.handle();
  }
  function removeRule(id) {
    const r = Data.getRule(id);
    if (!r) return;
    Util.confirm(I18n.t('删除计划'), I18n.t('确定删除「{n}」?', { n: r.name }), { okText: I18n.t('是'), cancelText: I18n.t('否'), danger: true }).then(ok => {
      if (ok) { Data.deleteRule(id); Util.toast(I18n.t('已删除'), 'success'); Router.handle(); }
    });
  }

  return { render, addPot, editPot, deposit, withdraw, removePot, addRule, toggleRule, removeRule };
})();
