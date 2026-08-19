/* =========================================================
   View: 账户管理 (多账户)
   ========================================================= */

const AccountsView = (() => {

  const typeMeta = {
    bank: { key: '银行卡', icon: 'landmark', color: '#163e6e' },
    alipay: { key: '支付宝', icon: 'wallet', color: '#1d4e89' },
    wechat: { key: '微信', icon: 'smartphone', color: '#2f6cab' },
    cash: { key: '现金', icon: 'banknote', color: '#2f6cab' },
    business: { key: '创业储备金', icon: 'briefcase', color: '#5b9bd5' },
    liability: { key: '负债账户', icon: 'shield-alert', color: '#5b9bd5' },
    other: { key: '其他', icon: 'briefcase', color: '#5b9bd5' },
  };

  function typeLabel(t) {
    return I18n.t((typeMeta[t] || typeMeta.other).key);
  }

  // ============ OCR 扫描识别(银行卡) ============
  let _ocrWorker = null;
  let _ocrLoading = null;
  const _ensureTesseract = () => new Promise((resolve, reject) => {
    if (window.Tesseract) return resolve();
    const s = document.createElement('script');
    s.src = 'vendor/tess/tesseract.min.js?v=7';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(I18n.t('Tesseract 主库加载失败')));
    document.head.appendChild(s);
  });
  const _getOcrWorker = async () => {
    if (_ocrWorker) return _ocrWorker;
    if (_ocrLoading) return _ocrLoading;
    _ocrLoading = (async () => {
      await _ensureTesseract();
      // 银行卡号只有数字: 用 eng(输出类 ~100) 远快于 chi_sim(数千中文类); 发卡行靠 BIN 查, 不靠 OCR
      const w = await window.Tesseract.createWorker('eng', 1, {
        workerPath: 'vendor/tess/worker.min.js?v=7',
        corePath: 'vendor/tess/tesseract-core-simd.wasm.js?v=7',
        langPath: 'vendor/tess/',
      });
      try { await w.setParameters({ tessedit_char_whitelist: '0123456789 ' }); } catch (e) {}
      _ocrWorker = w;
      _ocrLoading = null;
      return w;
    })();
    return _ocrLoading;
  };
  const _downscale = (img) => {
    const MAX = 1000; // 手机照片常 3000px+, 缩到 1000 内 → 像素量降 ~9 倍, LSTM 推理快近 9 倍
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    if (w0 <= MAX && h0 <= MAX) return img;
    const r = Math.min(MAX / w0, MAX / h0);
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * r); c.height = Math.round(h0 * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  };
  const _loadImage = (url) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = url;
  });
  const _recognizeCard = async (src) => {
    const w = await _getOcrWorker();
    const input = (src instanceof HTMLImageElement || src instanceof HTMLCanvasElement) ? _downscale(src) : src;
    const { data } = await w.recognize(input);
    return data.text || '';
  };
  const _extractDigits = (text) => {
    if (!text) return '';
    const long19 = text.match(/\d{16,19}/g);
    if (long19 && long19.length) return long19.sort((a, b) => b.length - a.length)[0];
    const long13 = text.match(/\d{13,15}/g);
    if (long13 && long13.length) return long13.sort((a, b) => b.length - a.length)[0];
    const all = text.replace(/\D/g, '');
    return all.length >= 13 ? all.slice(0, 19) : '';
  };

  function render(view) {
    const accounts = Data.getAccounts();
    const totals = Data.totals();

    view.innerHTML = `
      <div class="kpi-row kpi-row-3">
        <div class="kpi-cell">
          <div class="kpi-label">${I18n.t('资产合计')}</div>
          <div class="kpi-value" style="color:var(--brand-2)">${Util.fmtMoney(totals.totalAssets)}</div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">${I18n.t('负债合计')}</div>
          <div class="kpi-value" style="color:var(--up)">${Util.fmtMoney(totals.totalLiabilities)}</div>
        </div>
        <div class="kpi-cell">
          <div class="kpi-label">${I18n.t('净资产')}</div>
          <div class="kpi-value">${Util.fmtMoney(totals.netAssets)}</div>
        </div>
      </div>

      <div class="toolbar">
        <div class="toolbar-left"></div>
        <div class="toolbar-right">
          <button class="btn btn-primary btn-sm" onclick="window.__openAccountModal()">＋ ${I18n.t('新增账户')}</button>
        </div>
      </div>

      <div class="acc-grid" id="acc-grid"></div>
    `;

    renderGrid(accounts);
  }

  function renderGrid(accounts) {
    const grid = document.getElementById('acc-grid');
    if (!grid) return;
    if (!accounts.length) {
      grid.innerHTML = '<div class="empty"><div class="empty-icon">' + Util.icon('landmark') + '</div><div class="empty-title">' + I18n.t('还没有账户') + '</div><div class="empty-desc">' + I18n.t('点击右上角新增你的第一个账户') + '</div></div>';
      return;
    }
    grid.innerHTML = accounts.map(a => {
      const meta = typeMeta[a.type] || typeMeta.other;
      const isLiab = a.type === 'liability';
      const txCount = Data.getTransactions().filter(t => t.accountId === a.id || t.toAccountId === a.id).length;
      return `
        <div class="acc-card-big">
          <div class="acc-card-head">
            <div class="acc-icon">${Util.icon(meta.icon)}</div>
            <span class="tag ${isLiab ? 'tag-danger' : ''}">${Util.escapeHtml(typeLabel(a.type))}</span>
          </div>
          <div class="acc-card-body">
            <div class="acc-card-name">${Util.escapeHtml(a.name)}</div>
            <div class="acc-card-balance">
              ${isLiab ? '-' : ''}${Util.fmtMoney(a.balance)}
            </div>
            <div class="acc-card-num">${Util.escapeHtml(a.number || I18n.t('无卡号'))}</div>
            <div style="font-size:11px; color:var(--text-3); margin-top:6px;">${I18n.t('{n} 笔交易', { n: txCount })}</div>
          </div>
          <div class="acc-card-actions">
            <button class="acc-action" onclick="window.__openAccountModal('${a.id}')">
              ${Util.icon('edit')}
              <span>${I18n.t('编辑')}</span>
            </button>
            <button class="acc-action" onclick="window.__openAccountDetail('${a.id}')">
              ${Util.icon('receipt')}
              <span>${I18n.t('流水')}</span>
            </button>
            ${isLiab ? '' : `
            <button class="acc-action" onclick="window.__editBalance('${a.id}')">
              ${Util.icon('plus')}
              <span>${I18n.t('调整余额')}</span>
            </button>`}
            <button class="acc-action" onclick="window.__deleteAccount('${a.id}')" style="color:var(--up)">
              ${Util.icon('trash')}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.__openAccountModal = (id) => {
    const acc = id ? Data.getAccount(id) : null;
    const body = document.createElement('div');
    const types = Object.keys(typeMeta).filter(t => t !== 'other');
    const selType = acc?.type || 'bank';
    body.innerHTML = `
      <div class="acc-scanner">
        <div class="acc-scan-trigger" id="acc-scan-trigger" role="button" tabindex="0">
          <div class="acc-scan-icon">${Util.icon('scan-line')}</div>
          <div class="acc-scan-text">
            <div class="acc-scan-title">${I18n.t('扫描银行卡识别')}</div>
            <div class="acc-scan-desc">${I18n.t('本地OCR · 不上传 · 自动识别卡号与发卡行')}</div>
          </div>
          <div class="acc-scan-caret">${Util.icon('chevron-down')}</div>
        </div>
        <div class="acc-scan-panel" id="acc-scan-panel" hidden>
          <div class="acc-scan-actions">
            <button type="button" class="btn btn-ghost btn-sm" id="acc-scan-camera">${Util.icon('camera')}<span>${I18n.t('拍照识别')}</span></button>
            <button type="button" class="btn btn-ghost btn-sm" id="acc-scan-file">${Util.icon('image')}<span>${I18n.t('从相册选择')}</span></button>
            <input type="file" id="acc-scan-camera-in" accept="image/*" capture="environment" hidden />
            <input type="file" id="acc-scan-file-in" accept="image/*" hidden />
          </div>
          <div class="acc-scan-preview" id="acc-scan-preview"></div>
          <div class="acc-scan-status" id="acc-scan-status"></div>
          <div class="acc-scan-result" id="acc-scan-result" hidden></div>
        </div>
      </div>
      <div class="form-group">
        <label>${I18n.t('账户名称')}</label>
        <input type="text" class="input" id="a-name" value="${Util.escapeHtml(acc?.name || '')}" placeholder="${I18n.t('如: 招商银行卡')}" />
      </div>
      <div class="form-group">
        <label>${I18n.t('账户类型')}</label>
        <select class="input" id="a-type">
          ${types.map(t => `<option value="${t}" ${t === selType ? 'selected' : ''}>${I18n.t(typeMeta[t].key)}</option>`).join('')}
        </select>
      </div>
      <div class="split-2">
        <div class="form-group">
          <label>${I18n.t('当前余额')}</label>
          <input type="number" step="0.01" class="input" id="a-balance" value="${acc?.balance ?? 0}" />
        </div>
        <div class="form-group">
          <label>${I18n.t('卡号/账号 (选填)')}</label>
          <input type="text" class="input" id="a-number" value="${Util.escapeHtml(acc?.number || '')}" placeholder="**** 1234" />
        </div>
      </div>
      <div class="form-group">
        <label>${I18n.t('备注 (选填)')}</label>
        <input type="text" class="input" id="a-note" value="${Util.escapeHtml(acc?.note || '')}" placeholder="${I18n.t('如: 主要用于日常消费')}" />
      </div>
    `;
    Util.modal({
      title: acc ? I18n.t('编辑账户') : I18n.t('新增账户'),
      body,
      footer: `
        <button class="btn btn-ghost" data-act="close">${I18n.t('取消')}</button>
        <button class="btn btn-primary" id="a-save">${I18n.t('保存')}</button>
      `,
    });
    // ============ 扫描银行卡 ============
    (function bindScanner() {
      const trigger = document.getElementById('acc-scan-trigger');
      const panel = document.getElementById('acc-scan-panel');
      const btnCam = document.getElementById('acc-scan-camera');
      const btnFile = document.getElementById('acc-scan-file');
      const inCam = document.getElementById('acc-scan-camera-in');
      const inFile = document.getElementById('acc-scan-file-in');
      const preview = document.getElementById('acc-scan-preview');
      const status = document.getElementById('acc-scan-status');
      const result = document.getElementById('acc-scan-result');
      if (!trigger) return;
      const toggle = () => {
        const open = !panel.hidden;
        panel.hidden = open;
        trigger.classList.toggle('open', !open);
        if (!open) _getOcrWorker().catch(() => {}); // 展开即后台预热引擎, 拍完照已基本就绪
      };
      trigger.addEventListener('click', toggle);
      trigger.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      btnCam.addEventListener('click', () => inCam.click());
      btnFile.addEventListener('click', () => inFile.click());
      const handleFile = async (file) => {
        if (!file) return;
        const url = URL.createObjectURL(file);
        preview.innerHTML = `<img src="${url}" alt="card" />`;
        status.innerHTML = _ocrWorker
          ? `<span class="scan-spinner"></span> ${I18n.t('识别中…')}`
          : `<span class="scan-spinner"></span> ${I18n.t('正在加载 OCR 引擎…')}`;
        result.hidden = true;
        try {
          const im = await _loadImage(url);
          const text = await _recognizeCard(im);
          const digits = _extractDigits(text);
          if (!digits || digits.length < 13) {
            status.innerHTML = `<span class="scan-status-err">${Util.icon('info')} ${I18n.t('未识别到卡号,请手动输入或重试')}</span>`;
            return;
          }
          const bank = Util.lookupBank(digits);
          const formatted = Util.formatCardNumber(digits);
          const masked = Util.maskCardNumber(digits);
          document.getElementById('a-number').value = formatted;
          const nameIn = document.getElementById('a-name');
          if (!nameIn.value.trim() || /^[*\s\d]+$/.test(nameIn.value.trim())) {
            nameIn.value = bank ? (bank + (I18n.t('卡'))) : (I18n.t('银行卡') + ' ' + digits.slice(-4));
          }
          const typeSel = document.getElementById('a-type');
          if (Array.from(typeSel.options).some(o => o.value === 'bank')) typeSel.value = 'bank';
          result.innerHTML = `
            <div class="acc-scan-result-card">
              <div class="acc-scan-result-bank">${Util.icon('shield-check')} <span>${Util.escapeHtml(bank || I18n.t('未知发卡行'))}</span></div>
              <div class="acc-scan-result-num">${Util.escapeHtml(masked)}</div>
              <div class="acc-scan-result-hint">${I18n.t('已自动填入卡号与发卡行,可在下方继续编辑')}</div>
            </div>`;
          result.hidden = false;
          status.innerHTML = `<span class="scan-status-ok">${Util.icon('check-circle')} ${I18n.t('识别成功')}</span>`;
        } catch (e) {
          status.innerHTML = `<span class="scan-status-err">${Util.icon('info')} ${I18n.t('识别失败')}: ${Util.escapeHtml(e.message || '')}</span>`;
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      inCam.addEventListener('change', (e) => { const f = e.target.files[0]; handleFile(f); e.target.value = ''; });
      inFile.addEventListener('change', (e) => { const f = e.target.files[0]; handleFile(f); e.target.value = ''; });
    })();
    document.getElementById('a-save').addEventListener('click', () => {
      const name = document.getElementById('a-name').value.trim();
      if (!name) { Util.toast(I18n.t('请输入账户名称'), 'warn'); return; }
      const patch = {
        name,
        type: document.getElementById('a-type').value,
        balance: parseFloat(document.getElementById('a-balance').value) || 0,
        number: document.getElementById('a-number').value.trim(),
        note: document.getElementById('a-note').value.trim(),
      };
      if (acc) {
        Data.updateAccount(id, patch);
        Util.toast(I18n.t('账户已更新'), 'success');
      } else {
        Data.addAccount(patch);
        Util.toast(I18n.t('账户已创建'), 'success');
      }
      document.querySelector('.modal-mask')?.remove();
      render(document.getElementById('view'));
    });
  };

  window.__editBalance = (id) => {
    const acc = Data.getAccount(id);
    if (!acc) return;
    const body = document.createElement('div');
    body.innerHTML = `
      <div style="margin-bottom:14px; padding:14px; background:var(--bg-3); border-radius:var(--r-md);">
        <div style="font-size:12px;color:var(--text-muted);">${I18n.t('当前余额')}</div>
        <div style="font-size:22px;font-weight:700;font-family:'JetBrains Mono',monospace;">${Util.fmtMoney(acc.balance)}</div>
      </div>
      <div class="form-group">
        <label>${I18n.t('调整后余额')}</label>
        <input type="number" step="0.01" class="input" id="b-new" value="${acc.balance}" />
      </div>
      <div style="font-size:12px;color:var(--text-muted);">${I18n.t('说明: 手动调整余额不记录交易流水,用于修正对账差异。')}</div>
    `;
    Util.modal({
      title: I18n.t('调整余额') + ' · ' + Util.escapeHtml(acc.name),
      body,
      footer: `<button class="btn btn-ghost" data-act="close">${I18n.t('取消')}</button><button class="btn btn-primary" id="b-save">${I18n.t('确认调整')}</button>`,
    });
    document.getElementById('b-save').addEventListener('click', () => {
      const newBal = parseFloat(document.getElementById('b-new').value);
      if (isNaN(newBal)) { Util.toast(I18n.t('无效金额'), 'warn'); return; }
      Data.updateAccount(id, { balance: newBal });
      Util.toast(I18n.t('余额已调整'), 'success');
      document.querySelector('.modal-mask')?.remove();
      render(document.getElementById('view'));
    });
  };

  window.__deleteAccount = async (id) => {
    const acc = Data.getAccount(id);
    if (!acc) return;
    const txCount = Data.getTransactions().filter(t => t.accountId === id || t.toAccountId === id).length;
    const msg = I18n.t('确定删除账户「{name}」吗?', { name: acc.name }) +
      (txCount ? I18n.t(' 该账户下有 {n} 笔交易也将一并删除。', { n: txCount }) : '');
    const ok = await Util.confirm(I18n.t('删除账户'), msg, { okText: I18n.t('是'), cancelText: I18n.t('否'), danger: true });
    if (ok) {
      Data.deleteAccount(id);
      Util.toast(I18n.t('账户已删除'), 'success');
      render(document.getElementById('view'));
    }
  };

  window.__openAccountDetail = (id) => {
    Router.navigate('transactions', { account: id });
  };

  return { render };
})();
