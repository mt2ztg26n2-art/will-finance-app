/* =========================================================
   receipt.js — 电子储蓄单 (银行回单样式) v40+
   - Receipt.open(txId) 弹出银行回单样式的 HTML 卡片
   - 支持: 打印/保存 PDF (window.print + @media print) · 下载 PNG (html2canvas)
   - 依赖: vendor/html2canvas.min.js + vendor/jspdf.umd.min.js
   ========================================================= */
(function () {
  const TYPE_LABEL = { income: '收入', expense: '支出', transfer: '转账' };

  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtDateTime(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function fmtShortDate(ts) {
    const d = new Date(ts);
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }
  // 数字金额转中文大写(简化版,够用)
  function numToCny(num) {
    if (num === 0) return '零元整';
    const sign = num < 0 ? '负' : '';
    const n = Math.abs(Number(num) || 0);
    if (n < 0.01) return sign + '零元整';
    const intPart = Math.floor(n);
    const decPart = Math.round((n - intPart) * 100);
    const digits = '零一二三四五六七八九';
    const units = ['', '拾', '佰', '仟'];
    const bigUnits = ['', '万', '亿', '兆'];
    function sectionToCny(sec, withUnit) {
      if (sec === 0) return '';
      let out = '';
      const s = String(sec).padStart(4, '0');
      let lastZero = false;
      for (let i = 0; i < 4; i++) {
        const d = +s[i];
        if (d === 0) { lastZero = true; continue; }
        if (lastZero && out) out += '零';
        out += digits[d] + units[3 - i];
        lastZero = false;
      }
      return out + (withUnit || '');
    }
    let intStr = '';
    let groupIdx = 0;
    let rest = intPart;
    while (rest > 0) {
      const sec = rest % 10000;
      if (sec !== 0) intStr = sectionToCny(sec, bigUnits[groupIdx]) + intStr;
      else if (intStr && !intStr.startsWith('零')) intStr = '零' + intStr;
      rest = Math.floor(rest / 10000);
      groupIdx++;
    }
    intStr = intStr || '零';
    let decStr = '';
    if (decPart === 0) decStr = '整';
    else {
      const j = Math.floor(decPart / 10), f = decPart % 10;
      decStr = (j > 0 ? digits[j] + '角' : '') + (f > 0 ? digits[f] + '分' : '整');
    }
    return sign + intStr + '元' + decStr;
  }

  function buildReceiptHTML(tx) {
    const acc = Data.getAccount(tx.accountId);
    const toAcc = tx.toAccountId ? Data.getAccount(tx.toAccountId) : null;
    const cat = tx.categoryId ? Data.getCategoryById(tx.categoryId) : null;
    const catName = cat ? Data.getCategoryBreadcrumb(cat.id, ' / ') : (tx.type === 'transfer' ? '账户间转账' : '未分类');
    const accName = acc ? acc.name : '—';
    const toAccName = toAcc ? toAcc.name : '—';
    const typeLabel = TYPE_LABEL[tx.type] || tx.type;
    const amount = Number(tx.amount || 0);
    const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '';
    const amountClass = tx.type === 'income' ? 'pos' : tx.type === 'expense' ? 'neg' : '';
    const balance = Data.getBalanceAfterTx(tx);
    // 校验位(纯展示,无安全意义)
    const checkCode = (tx.id || '').slice(-6).toUpperCase();

    return `
      <div class="receipt" id="receipt-print-area">
        <div class="receipt-header">
          <div class="receipt-bank">ICBC · 中国工商银行</div>
          <div class="receipt-title">电子储蓄单</div>
          <div class="receipt-sub">个人金融 · 交易回单</div>
        </div>
        <div class="receipt-barcode">
          <span class="bar">|| ||| | ||| ||| || | ||| | |||</span>
          <span class="barcode-id">${(tx.id || '').slice(0, 8).toUpperCase()} · ${checkCode}</span>
        </div>
        <table class="receipt-table">
          <tbody>
            <tr><th>交易单号</th><td class="mono">${(tx.id || '').toUpperCase()}</td></tr>
            <tr><th>日期时间</th><td>${fmtDateTime(tx.time)}</td></tr>
            <tr><th>类型</th><td>${typeLabel}</td></tr>
            <tr class="receipt-amt-row"><th>金额</th><td class="receipt-amt ${amountClass}">${sign}¥${amount.toFixed(2)}</td></tr>
            <tr><th>大写</th><td>${numToCny(amount)}</td></tr>
            <tr><th>${tx.type === 'transfer' ? '转出账户' : '账户'}</th><td>${accName}</td></tr>
            ${tx.type === 'transfer' ? `<tr><th>转入账户</th><td>${toAccName}</td></tr>` : ''}
            <tr><th>对方/付款方</th><td>${(tx.payee || '—').replace(/</g, '&lt;')}</td></tr>
            <tr><th>分类</th><td>${catName}</td></tr>
            <tr><th>地点</th><td>${(tx.location || '—').replace(/</g, '&lt;')}</td></tr>
            <tr><th>备注</th><td>${(tx.description || '—').replace(/</g, '&lt;')}</td></tr>
            <tr><th>账户余额</th><td class="mono">¥${(balance || 0).toFixed(2)}</td></tr>
          </tbody>
        </table>
        <div class="receipt-footer">
          <div class="receipt-stamp">工商银行 · 业务专用章</div>
          <div class="receipt-tip">本电子回单仅供个人记账参考,不作为法律凭证。如有疑问请致电 95588。</div>
        </div>
      </div>
    `;
  }

  function open(txId) {
    const tx = Data.getTransactions().find(t => t.id === txId);
    if (!tx) { Util.toast('未找到该交易', 'error'); return; }
    const body = document.createElement('div');
    body.innerHTML = buildReceiptHTML(tx);
    const footer = `
      <button class="btn btn-ghost" data-act="close">关闭</button>
      <button class="btn btn-ghost" id="rcpt-png">📷 下载 PNG</button>
      <button class="btn btn-primary" id="rcpt-print">🖨 打印 / 保存 PDF</button>
    `;
    Util.modal({ title: '🧾 电子储蓄单', body, footer, size: 'large' });
    const printArea = body.querySelector('#receipt-print-area');

    document.getElementById('rcpt-print').addEventListener('click', () => {
      // 触发打印(CSS @media print 隐藏其它内容)
      document.body.classList.add('receipt-printing');
      const restore = () => {
        document.body.classList.remove('receipt-printing');
        window.removeEventListener('afterprint', restore);
      };
      window.addEventListener('afterprint', restore);
      setTimeout(() => window.print(), 80);
    });

    document.getElementById('rcpt-png').addEventListener('click', async () => {
      if (typeof html2canvas !== 'function') {
        Util.toast('html2canvas 未加载,无法下载 PNG', 'error');
        return;
      }
      Util.toast('正在生成图片...', 'info');
      try {
        const canvas = await html2canvas(printArea, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
        canvas.toBlob((blob) => {
          if (!blob) { Util.toast('生成失败', 'error'); return; }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `电子储蓄单_${fmtShortDate(tx.time)}_${(tx.id || '').slice(0, 6)}.png`;
          a.click();
          URL.revokeObjectURL(url);
          Util.toast('✓ 已下载 PNG', 'success');
        }, 'image/png');
      } catch (e) {
        console.error(e);
        Util.toast('生成失败: ' + e.message, 'error');
      }
    });
  }

  // 挂到全局
  window.Receipt = { open, _buildHTML: buildReceiptHTML };
})();
