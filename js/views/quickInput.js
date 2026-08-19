/* =========================================================
   View: 智能记账 (文字 / 语音 / 图片 OCR)
   ========================================================= */

const QuickInputView = (() => {

  let recognition = null;
  let isRecording = false;
  let previewParsed = null;
  let ocrWorker = null;
  let ocrLoading = null;

  function render(view) {
    view.innerHTML = `
      <div class="quick-wrap">
        <!-- 左: 输入卡 -->
        <div>
          <div class="input-card">
            <div class="input-tabs">
              <button class="input-tab active" data-mode="text">${Util.icon('pen')} ${I18n.t('文字记账')}</button>
              <button class="input-tab" data-mode="voice">${Util.icon('mic')} ${I18n.t('语音记账')}</button>
              <button class="input-tab" data-mode="image">${Util.icon('image')} ${I18n.t('图片记账')}</button>
            </div>

            <!-- 文字模式 -->
            <div id="text-mode">
              <div class="form-group">
                <label>${I18n.t('快速描述一笔交易')}</label>
                <textarea id="q-text" class="big-input" rows="3" placeholder="例如：今天用招商银行卡花了65元在XX书店买教材(北京)&#10;或：收到客户李经理转账800元创业收入"></textarea>
              </div>
              <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
                ${['支付宝花了38吃饭', '收到创业收入800', '转账500到创业储备金', '用微信付了20打车', '招商银行卡收到父母生活费2500', '花呗分期买了手机2000'].map(s => `<button class="chip" onclick="window.__fillExample('${s}')">${s}</button>`).join('')}
              </div>
              <button class="btn btn-primary btn-block" id="q-parse-btn">${Util.icon('wand')} ${I18n.t('智能解析')}</button>
              <div style="font-size:11px; color:var(--text-muted); margin-top:8px; text-align:center;">${I18n.t('提示：Ctrl/Cmd + Enter 快速解析')}</div>
            </div>

            <!-- 语音模式 -->
            <div id="voice-mode" style="display:none;">
              <button class="voice-btn" id="q-voice-btn">
                <div class="voice-icon">${Util.icon('mic')}</div>
                <div id="q-voice-text">${I18n.t('点击开始语音记账')}</div>
              </button>
              <div style="margin-top:10px; font-size:12px; color:var(--text-muted); text-align:center;">${I18n.t('支持 Chrome / Edge 浏览器 · 需授权麦克风')}</div>
            </div>

            <!-- 图片模式 -->
            <div id="image-mode" style="display:none;">
              <div id="q-dropzone" class="dropzone">
                <div id="q-dz-empty" class="dz-empty">
                  <div style="font-size:36px; line-height:1; color:var(--brand);">${Util.icon('image')}</div>
                  <div style="margin-top:10px; font-weight:600; color:var(--text);">${I18n.t('拖拽 / 粘贴 / 点击 上传账单截图')}</div>
                  <div style="margin-top:4px; font-size:12px; color:var(--text-muted);">${I18n.t('支持微信、支付宝、银行短信等截图 · 自动识别金额/账户/分类')}</div>
                </div>
                <img id="q-img-preview" class="dz-preview" style="display:none;" alt="预览" />
                <div id="q-dz-actions" style="display:none; margin-top:10px;">
                  <button class="btn btn-ghost btn-sm" id="q-reupload">${Util.icon('refresh-cw')} ${I18n.t('重选')}</button>
                  <button class="btn btn-primary btn-sm" id="q-ocr-btn" style="margin-left:8px;">${Util.icon('wand')} ${I18n.t('开始识别')}</button>
                </div>
                <input type="file" id="q-file" accept="image/*" style="display:none;" />
              </div>
              <div id="q-ocr-status" style="display:none; margin-top:10px; padding:10px 12px; background:var(--surface-3); border-radius:var(--r-md); font-size:12px; color:var(--text-muted);"></div>
              <div id="q-ocr-text-wrap" style="display:none; margin-top:10px;">
                <label style="font-size:12px; color:var(--text-muted);">${I18n.t('识别结果（可手动修正）')}</label>
                <textarea id="q-ocr-text" class="big-input" rows="3" placeholder="${I18n.t('OCR 识别后的文本…')}"></textarea>
                <button class="btn btn-primary btn-block" id="q-ocr-parse-btn" style="margin-top:8px;">${Util.icon('check')} ${I18n.t('解析此文本')}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 右: 预览 + 技巧 -->
        <div>
          <div class="input-card" style="height:100%;">
            <div class="card-title">
              <div class="card-title-text">
                ${Util.icon('check-circle', 'card-title-icon')}
                ${I18n.t('识别结果预览')}
              </div>
            </div>
            <div class="parse-card empty" id="q-preview"></div>

            <div style="margin-top:18px; padding-top:14px; border-top:1px solid var(--border);">
              <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px; font-weight:600;">${I18n.t('记账技巧')}</div>
              <ul style="margin:0; padding-left:18px; color:var(--text-muted); font-size:12.5px; line-height:1.9;">
                <li>${I18n.t('说出 金额：系统自动识别（支持"万/千"）')}</li>
                <li>${I18n.t('说出 账户：招商、支付宝、微信、现金…')}</li>
                <li>${I18n.t('说出 分类：吃饭、交通、买书、设备…')}</li>
                <li>${I18n.t('说出 对方/地点：客户名、餐厅、城市')}</li>
              </ul>
              <div style="margin-top:10px; padding:10px; background:var(--surface-3); border-radius:var(--r-sm); font-size:12px; color:var(--text-muted); font-family:'JetBrains Mono', monospace;">
                "用微信付了25打车去中关村"
                <div style="margin-top:4px; color:var(--text-dim);">→ 支出 ¥25 · 微信 · 交通 · 中关村</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const tabs = Util.$$('.input-tab');
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const mode = t.dataset.mode;
      document.getElementById('text-mode').style.display = mode === 'text' ? 'block' : 'none';
      document.getElementById('voice-mode').style.display = mode === 'voice' ? 'block' : 'none';
      document.getElementById('image-mode').style.display = mode === 'image' ? 'block' : 'none';
      if (mode === 'voice') initVoice();
    }));

    const parseBtn = document.getElementById('q-parse-btn');
    if (parseBtn) parseBtn.addEventListener('click', runParse);

    const textarea = document.getElementById('q-text');
    if (textarea) textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runParse();
    });

    const voiceBtn = document.getElementById('q-voice-btn');
    if (voiceBtn) voiceBtn.addEventListener('click', toggleVoice);

    // 图片模式事件
    bindImageEvents();
  }

  function bindImageEvents() {
    const dz = document.getElementById('q-dropzone');
    const fileInput = document.getElementById('q-file');
    const previewImg = document.getElementById('q-img-preview');
    const dzEmpty = document.getElementById('q-dz-empty');
    const dzActions = document.getElementById('q-dz-actions');
    const ocrBtn = document.getElementById('q-ocr-btn');
    const reuploadBtn = document.getElementById('q-reupload');
    const ocrParseBtn = document.getElementById('q-ocr-parse-btn');

    if (!dz) return;

    // 点击上传
    dz.addEventListener('click', (e) => {
      if (e.target.closest('button')) return; // 让按钮自己处理
      if (!previewImg || previewImg.style.display === 'none') fileInput.click();
    });

    // 拖拽
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dz-hover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dz-hover'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('dz-hover');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadImage(f);
    });

    // 粘贴
    document.addEventListener('paste', (e) => {
      if (document.querySelector('.input-tab.active')?.dataset.mode !== 'image') return;
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const it of items) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) { loadImage(f); e.preventDefault(); break; }
        }
      }
    });

    fileInput.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) loadImage(f);
    });

    reuploadBtn?.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
    ocrBtn?.addEventListener('click', (e) => { e.stopPropagation(); runOCR(); });
    ocrParseBtn?.addEventListener('click', (e) => { e.stopPropagation(); runOCRParse(); });
  }

  function loadImage(file) {
    if (!file || !file.type.startsWith('image/')) { Util.toast(I18n.t('请选择图片文件'), 'warn'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = document.getElementById('q-img-preview');
      const dzEmpty = document.getElementById('q-dz-empty');
      const dzActions = document.getElementById('q-dz-actions');
      const ocrStatus = document.getElementById('q-ocr-status');
      const ocrTextWrap = document.getElementById('q-ocr-text-wrap');
      img.src = ev.target.result;
      img.style.display = 'block';
      dzEmpty.style.display = 'none';
      dzActions.style.display = 'block';
      if (ocrStatus) { ocrStatus.style.display = 'none'; ocrStatus.textContent = ''; }
      if (ocrTextWrap) ocrTextWrap.style.display = 'none';
      Util.toast(I18n.t('图片已加载'), 'success');
    };
    reader.readAsDataURL(file);
  }

  async function ensureOCRWorker() {
    if (ocrWorker) return ocrWorker;
    if (ocrLoading) return ocrLoading;
    if (typeof window.Tesseract === 'undefined') {
      // 懒加载主库
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'vendor/tess/tesseract.min.js?v=7';
        s.onload = res; s.onerror = () => rej(new Error(I18n.t('Tesseract 主库加载失败')));
        document.head.appendChild(s);
      });
    }
    const status = document.getElementById('q-ocr-status');
    const show = (t) => { if (status) { status.style.display = 'block'; status.textContent = t; } };
    show(I18n.t('正在加载 OCR 引擎…'));
    ocrLoading = (async () => {
      try {
        const w = await window.Tesseract.createWorker('chi_sim', 1, {
          workerPath: 'vendor/tess/worker.min.js?v=7',
          corePath: 'vendor/tess/tesseract-core-simd.wasm.js?v=7',
          langPath: 'vendor/tess/',
          gzip: false, // GitHub Pages 对 .gz 返回空体, 改用未压缩 .traineddata
          logger: (m) => {
            if (m.status === 'recognizing text') show(I18n.t('识别中… {p}%', { p: Math.round((m.progress || 0) * 100) }));
            else if (m.status) show(I18n.t('OCR · {s}…', { s: m.status }));
          },
        });
        ocrWorker = w;
        show(I18n.t('OCR 引擎就绪'));
        return w;
      } catch (e) {
        show(I18n.t('OCR 引擎加载失败: ') + e.message);
        throw e;
      } finally {
        ocrLoading = null;
      }
    })();
    return ocrLoading;
  }

  async function runOCR() {
    const img = document.getElementById('q-img-preview');
    if (!img || !img.src || img.style.display === 'none') { Util.toast(I18n.t('请先选择图片'), 'warn'); return; }
    const status = document.getElementById('q-ocr-status');
    try {
      const worker = await ensureOCRWorker();
      status.style.display = 'block'; status.textContent = I18n.t('识别中…');
      const { data } = await worker.recognize(img.src);
      const text = (data.text || '').trim();
      document.getElementById('q-ocr-text').value = text;
      document.getElementById('q-ocr-text-wrap').style.display = 'block';
      status.textContent = I18n.t('识别完成 · 共 {n} 字', { n: text.length });
      // 自动解析
      runOCRParse();
      Util.toast(I18n.t('识别完成'), 'success');
    } catch (e) {
      status.textContent = I18n.t('识别失败: ') + e.message;
      Util.toast(I18n.t('OCR 识别失败, 请手动输入或重试'), 'error');
    }
  }

  function runOCRParse() {
    const text = document.getElementById('q-ocr-text')?.value.trim();
    if (!text) { Util.toast(I18n.t('请输入或识别文本'), 'warn'); return; }
    // 把 OCR 文本也同步到文字区
    const qText = document.getElementById('q-text');
    if (qText) qText.value = text;
    const parsed = Parser.parse(text, {
      accounts: Data.getAccounts(),
      categories: Data.getCategories(),
    });
    previewParsed = parsed;
    renderPreview(parsed);
  }

  function runParse() {
    const text = document.getElementById('q-text').value.trim();
    if (!text) { Util.toast(I18n.t('请输入描述'), 'warn'); return; }
    const parsed = Parser.parse(text, {
      accounts: Data.getAccounts(),
      categories: Data.getCategories(),
    });
    previewParsed = parsed;
    renderPreview(parsed);
  }

  function renderPreview(p) {
    const el = document.getElementById('q-preview');
    el.classList.add('show');
    el.classList.remove('empty');
    const typeLabel = p.type === 'income' ? I18n.t('收入') : p.type === 'expense' ? I18n.t('支出') : I18n.t('转账');

    el.innerHTML = `
      <div style="font-size:13px; color:var(--text-muted); margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <span>${I18n.t('已解析 · 请确认无误后保存')}</span>
        <span class="tag tag-info">${typeLabel}</span>
      </div>
      <div style="display:grid; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--surface-3); border-radius:var(--r-sm);">
          <span style="color:var(--text-muted); font-size:13px;">${I18n.t('金额')}</span>
          <span style="font-weight:700; font-size:20px; color:${p.type === 'income' ? 'var(--up)' : p.type === 'expense' ? 'var(--down)' : 'var(--info)'}">
            ${p.type === 'income' ? '+' : p.type === 'expense' ? '-' : ''}${Util.fmtMoney(p.amount)}
          </span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="color:var(--text-muted); font-size:13px;">${p.type === 'transfer' ? I18n.t('转出账户') : I18n.t('账户')}</span>
          <span>${p.account ? Util.escapeHtml(p.account.name) : '<span style="color:var(--warn)">' + I18n.t('未识别') + '</span>'}</span>
        </div>
        ${p.type === 'transfer' && p.toAccount ? `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:var(--text-muted); font-size:13px;">${I18n.t('转入账户')}</span>
            <span>${Util.escapeHtml(p.toAccount.name)}</span>
          </div>
        ` : ''}
        ${p.category ? `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:var(--text-muted); font-size:13px;">${I18n.t('分类')}</span>
            <span>${Util.icon(Util.categoryIcon(p.category))} ${Util.escapeHtml(Data.getCategoryBreadcrumb(p.category.id, ' / '))}</span>
          </div>
        ` : '<div style="color:var(--warn); font-size:13px;">' + I18n.t('未识别分类') + '</div>'}
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="color:var(--text-muted); font-size:13px;">${I18n.t('对方')}</span>
          <span>${Util.escapeHtml(p.payee || '—')}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="color:var(--text-muted); font-size:13px;">${I18n.t('地点')}</span>
          <span>${Util.escapeHtml(p.location || '—')}</span>
        </div>
      </div>
      <div style="display:flex; gap:8px; margin-top:16px;">
        <button class="btn btn-ghost" style="flex:1;" onclick="window.__editParsed()">${Util.icon('pen')} ${I18n.t('修正')}</button>
        <button class="btn btn-primary" style="flex:2;" onclick="window.__saveParsed()">${Util.icon('check')} ${I18n.t('保存入账')}</button>
      </div>
    `;
  }

  function initVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      document.getElementById('q-voice-btn').innerHTML = '<div style="color:var(--warn); font-size:13px; padding:20px;">' + I18n.t('当前浏览器不支持语音识别') + '<br>' + I18n.t('请使用 Chrome / Edge') + '</div>';
      return;
    }
    recognition = new SR();
    recognition.lang = 'zh-CN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (e) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      document.getElementById('q-voice-text').textContent = transcript || I18n.t('正在聆听…');
      if (e.results[0].isFinal) {
        document.getElementById('q-text').value = transcript;
        runParse();
        stopVoice();
      }
    };
    recognition.onerror = (e) => { Util.toast(I18n.t('语音识别失败: ') + e.error, 'error'); stopVoice(); };
    recognition.onend = () => stopVoice();
  }

  function toggleVoice() {
    if (!recognition) initVoice();
    if (!recognition) return;
    if (isRecording) stopVoice();
    else {
      isRecording = true;
      const btn = document.getElementById('q-voice-btn');
      btn.classList.add('recording');
      document.getElementById('q-voice-text').textContent = I18n.t('正在聆听… (点击停止)');
      try { recognition.start(); } catch (e) {}
    }
  }

  function stopVoice() {
    isRecording = false;
    if (recognition) { try { recognition.stop(); } catch (e) {} }
    const btn = document.getElementById('q-voice-btn');
    if (btn) {
      btn.classList.remove('recording');
      document.getElementById('q-voice-text').textContent = I18n.t('点击开始语音记账');
    }
  }

  // 全局辅助
  window.__fillExample = (s) => {
    const ta = document.getElementById('q-text');
    if (ta) { ta.value = s; runParse(); }
  };

  window.__editParsed = () => {
    Router.navigate('transactions');
    setTimeout(() => { if (window.__openTxModal) window.__openTxModal(previewParsed); }, 200);
  };

  window.__saveParsed = () => {
    if (!previewParsed) return;
    if (!previewParsed.account) { Util.toast(I18n.t('请选择账户'), 'warn'); return; }
    if (!previewParsed.category && previewParsed.type !== 'transfer') { Util.toast(I18n.t('请选择分类'), 'warn'); return; }
    const tx = {
      type: previewParsed.type,
      amount: previewParsed.amount,
      time: Date.now(),
      accountId: previewParsed.account.id,
      toAccountId: previewParsed.toAccount ? previewParsed.toAccount.id : null,
      categoryId: previewParsed.category ? previewParsed.category.id : null,
      payee: previewParsed.payee,
      location: previewParsed.location,
      description: previewParsed.description,
    };
    Data.addTransaction(tx);
    Util.toast(I18n.t('记账成功! 账户余额已同步'), 'success');
    document.getElementById('q-text').value = '';
    const preview = document.getElementById('q-preview');
    if (preview) { preview.classList.remove('show'); preview.classList.add('empty'); preview.innerHTML = ''; }
    previewParsed = null;
    // 触发数据变更, 让所有视图同步刷新
    Data.emit('change');
  };

  return { render };
})();
