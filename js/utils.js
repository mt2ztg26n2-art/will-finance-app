/* =========================================================
   Utils — 通用工具函数
   ========================================================= */

const Util = (() => {
  const fmtMoney = (n, withSign = false) => {
    if (typeof n !== 'number' || isNaN(n)) n = 0;
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (withSign) return (n < 0 ? '-' : (n > 0 ? '+' : '')) + '¥' + formatted;
    return (n < 0 ? '-' : '') + '¥' + formatted;
  };

  const fmtMoneyCompact = (n) => {
    if (typeof n !== 'number' || isNaN(n)) n = 0;
    const abs = Math.abs(n);
    let str;
    if (abs >= 10000) str = (n / 10000).toFixed(2) + ' 万';
    else if (abs >= 1000) str = (n / 1000).toFixed(1) + ' 千';
    else str = n.toFixed(2);
    return (n < 0 ? '-' : '') + '¥' + str;
  };

  // 蓝单色：涨用深蓝 --up，跌用浅蓝 --down（覆盖股市红绿惯例）
  const fmtMoneyChange = (n) => {
    if (typeof n !== 'number' || isNaN(n)) n = 0;
    const sign = n > 0 ? '+' : '';
    return `<span style="color:${n >= 0 ? 'var(--up)' : 'var(--down)'}">${sign}${fmtMoney(n)}</span>`;
  };

  const fmtDate = (ts) => {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const fmtDateTime = (ts) => {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  };
  const fmtTime = (ts) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const fmtMonth = (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const fmtRelativeTime = (ts) => {
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return Math.floor(diff / 60_000) + ' 分钟前';
    if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + ' 小时前';
    if (diff < 7 * 86_400_000) return Math.floor(diff / 86_400_000) + ' 天前';
    return fmtDate(ts);
  };

  const todayMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const monthRange = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    const start = new Date(y, m - 1, 1).getTime();
    const end = new Date(y, m, 1).getTime();
    return [start, end];
  };
  const monthLabel = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    return `${y} 年 ${m} 月`;
  };

  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHtml = (str) => String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const toast = (msg, type = 'info', title = '') => {
    const root = $('#toast-root');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const titleStr = {
      success: '成功',
      error: '错误',
      warn: '警告',
      info: '提示',
    }[type] || '提示';
    const icoMap = { success: 'check-circle', error: 'x', warn: 'info', info: 'bell' };
    const ico = icoMap[type] || 'info';
    el.innerHTML = `
      <div class="toast-ico">${Util.icon(ico)}</div>
      <div style="flex:1; min-width:0;">
        <div class="toast-title">${escapeHtml(title || titleStr)}</div>
        <div class="toast-msg">${escapeHtml(msg)}</div>
      </div>
    `;
    root.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'toastIn .25s ease reverse';
      setTimeout(() => el.remove(), 250);
    }, 3000);
  };

  const modal = ({ title, body, footer, size = '' }) => {
    return new Promise((resolve) => {
      const root = $('#modal-root');
      const mask = document.createElement('div');
      mask.className = 'modal-mask';
      const modalSize = size === 'large' ? 'modal-large' : size === 'xlarge' ? 'modal-xlarge' : '';
      mask.innerHTML = `
        <div class="modal ${modalSize}">
          <div class="modal-header">
            <div class="modal-title">${escapeHtml(title)}</div>
            <button class="modal-close" data-act="close">
              ${Util.icon('x')}
            </button>
          </div>
          <div class="modal-body"></div>
          <div class="modal-footer"></div>
        </div>
      `;
      const bodyEl = $('.modal-body', mask);
      const footerEl = $('.modal-footer', mask);

      if (typeof body === 'string') bodyEl.innerHTML = body;
      else if (body instanceof HTMLElement) bodyEl.appendChild(body);

      if (footer === false) footerEl.style.display = 'none';
      else if (typeof footer === 'string') footerEl.innerHTML = footer;
      else if (footer instanceof HTMLElement) footerEl.appendChild(footer);
      else {
        footerEl.innerHTML = `
          <button class="btn btn-ghost" data-act="close">关闭</button>
        `;
      }

      const close = (val) => { mask.remove(); resolve(val); };
      mask.addEventListener('click', (e) => {
        if (e.target === mask) close(null);
        const t = e.target.closest('[data-act]');
        if (!t) return;
        const act = t.dataset.act;
        if (act === 'close') close(null);
        else if (act === 'confirm') close(true);
        else if (act === 'cancel') close(false);
      });
      root.appendChild(mask);
    });
  };

  const confirm = (title, msg, opts = {}) => modal({
    title,
    body: `<div style="font-size:14px; line-height:1.7;">${escapeHtml(msg)}</div>`,
    footer: `
      <button class="btn btn-ghost" data-act="cancel">${escapeHtml(opts.cancelText || '取消')}</button>
      <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-act="confirm">${escapeHtml(opts.okText || '确定')}</button>
    `,
  });

  // 登录后励志文案 —— 三类混排：诗词(真实古典名句) / 文案(现代格言) / 英文(真实名言)
  // 诗词与英文均注明真实出处, 文案为无署名格言(绝不杜撰署名)。每次登录随机抽一条, 故内容会变化。
  const WELCOME_QUOTES = [
    // —— 诗词：真实古典名句（带出处）——
    { type: 'poem', text: '天行健，君子以自强不息。', author: '《周易 · 乾卦》' },
    { type: 'poem', text: '非淡泊无以明志，非宁静无以致远。', author: '诸葛亮《诫子书》' },
    { type: 'poem', text: '不积跬步，无以至千里；不积小流，无以成江海。', author: '荀子《劝学》' },
    { type: 'poem', text: '会当凌绝顶，一览众山小。', author: '杜甫《望岳》' },
    { type: 'poem', text: '长风破浪会有时，直挂云帆济沧海。', author: '李白《行路难》' },
    { type: 'poem', text: '腹有诗书气自华。', author: '苏轼《和董传留别》' },
    { type: 'poem', text: '先天下之忧而忧，后天下之乐而乐。', author: '范仲淹《岳阳楼记》' },
    { type: 'poem', text: '不畏浮云遮望眼，自缘身在最高层。', author: '王安石《登飞来峰》' },
    { type: 'poem', text: '纸上得来终觉浅，绝知此事要躬行。', author: '陆游《冬夜读书示子聿》' },
    { type: 'poem', text: '黑发不知勤学早，白首方悔读书迟。', author: '颜真卿《劝学》' },
    { type: 'poem', text: '知行合一。', author: '王阳明' },
    { type: 'poem', text: '学而不思则罔，思而不学则殆。', author: '《论语 · 为政》' },
    { type: 'poem', text: '三人行，必有我师焉。', author: '《论语 · 述而》' },
    { type: 'poem', text: '博学之，审问之，慎思之，明辨之，笃行之。', author: '《礼记 · 中庸》' },
    // —— 文案：现代理财/生活格言（无署名，不杜撰出处）——
    { type: 'prose', text: '把省钱变成一种习惯，让财富悄悄长大。', author: '' },
    { type: 'prose', text: '每一笔记录，都是对生活的认真。', author: '' },
    { type: 'prose', text: '今天的克制，是为了明天更多的选择。', author: '' },
    { type: 'prose', text: '钱要花在刀刃上，账要记在心里。', author: '' },
    { type: 'prose', text: '先存钱，再消费，自由从这一刻开始。', author: '' },
    { type: 'prose', text: '理财不是变富，而是不再慌张。', author: '' },
    { type: 'prose', text: '慢慢来，比较快。', author: '' },
    { type: 'prose', text: '攒下的每一分，都是未来的底气。', author: '' },
    // —— 英文：真实名言（带作者）——
    { type: 'en', text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
    { type: 'en', text: 'Beware of little expenses; a small leak will sink a great ship.', author: 'Benjamin Franklin' },
    { type: 'en', text: 'Do not save what is left after spending, but spend what is left after saving.', author: 'Warren Buffett' },
    { type: 'en', text: 'The man who moves a mountain begins by carrying away small stones.', author: 'Ralph Waldo Emerson' },
    { type: 'en', text: 'It is not that we have a short time to live, but that we waste a lot of it.', author: 'Seneca' },
    { type: 'en', text: 'Whether you think you can or you think you can’t, you’re right.', author: 'Henry Ford' },
    { type: 'en', text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
    { type: 'en', text: 'We are what we repeatedly do. Excellence is not an act, but a habit.', author: 'Aristotle' },
  ];

  const WELCOME_TAGS = { poem: '诗词', prose: '文案', en: 'EN' };

  const literatiWelcome = () => {
    const root = $('#modal-root');
    if (!root) return;
    const q = WELCOME_QUOTES[Math.floor(Math.random() * WELCOME_QUOTES.length)];
    const tag = WELCOME_TAGS[q.type] || '';
    const authorLine = q.author
      ? `<div class="wb-quote-author">— ${escapeHtml(q.author)}</div>`
      : `<div class="wb-quote-author wb-quote-author--muted">每日一句 · 与君共勉</div>`;
    const mask = document.createElement('div');
    mask.className = 'modal-mask wb-quote-mask';
    mask.innerHTML = `
      <div class="wb-quote-modal" role="dialog" aria-modal="true">
        <button class="wb-quote-close" title="关闭" data-act="close">${Util.icon('x')}</button>
        ${tag ? `<div class="wb-quote-tag">${escapeHtml(tag)}</div>` : ''}
        <div class="wb-quote-mark">“</div>
        <div class="wb-quote-text${q.type === 'en' ? ' wb-quote-text-en' : ''}">${escapeHtml(q.text)}</div>
        ${authorLine}
        <div class="wb-quote-actions">
          <button class="btn btn-ghost" data-act="close">取消</button>
          <button class="btn btn-primary" data-act="enter">进入</button>
        </div>
      </div>`;
    const close = () => mask.remove();
    mask.addEventListener('click', (e) => {
      if (e.target === mask) return;
      if (e.target.closest('[data-act]')) close();
    });
    root.appendChild(mask);
  };

  const debounce = (fn, ms = 300) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  const hash = (str) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  };

  const download = (filename, content, type = 'text/plain') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  };

  const toCSV = (rows, headers) => {
    const escape = (s) => {
      const v = String(s ?? '');
      if (v.includes(',') || v.includes('"') || v.includes('\n')) return '"' + v.replace(/"/g, '""') + '"';
      return v;
    };
    const lines = [headers.map(escape).join(',')];
    for (const r of rows) lines.push(headers.map((_, i) => escape(r[i])).join(','));
    return lines.join('\n');
  };

  const ICON_PATHS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M21 12a2 2 0 0 0-2-2h-4a2 2 0 0 0 0 4h4a2 2 0 0 0 2-2Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>',
    'file-bar': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13v4M12 11v6M15 14v3"/>',
    graduation: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    'shield-alert': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    'git-branch': '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    'bar-chart': '<line x1="3" y1="21" x2="21" y2="21"/><rect x="5" y="10" width="3.5" height="8" rx="1"/><rect x="10.25" y="5" width="3.5" height="13" rx="1"/><rect x="15.5" y="13" width="3.5" height="5" rx="1"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    landmark: '<line x1="3" y1="21" x2="21" y2="21"/><path d="M3 10h18"/><path d="M5 10V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M7 10v7M12 10v7M17 10v7"/>',
    scale: '<path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7 2 14a3 3 0 0 0 6 0L5 7z"/><path d="M19 7l-3 7a3 3 0 0 0 6 0l-3-7z"/>',
    'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
    info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    'line-chart': '<path d="M3 3v18h18"/><path d="M19 9l-5 5-4-4-3 3"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'arrow-up': '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
    'arrow-down': '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
    'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
    'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    'credit-card': '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
    banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/>',
    smartphone: '<rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>',
    'arrow-left-right': '<line x1="3" y1="12" x2="21" y2="12"/><polyline points="8 7 3 12 8 17"/><polyline points="16 7 21 12 16 17"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    wand: '<path d="M15 4V2"/><path d="M15 10V8"/><path d="M12.5 6.5h-2"/><path d="M17.5 6.5h-2"/><path d="M3 21l9-9"/>',
    'refresh-cw': '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    'scan-line': '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.5"/>',
    'shield-check': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
    'transport': '<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16"/><circle cx="8" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/><path d="M7.5 17.5h9"/>',
    'medical': '<rect x="9" y="3" width="6" height="18" rx="1"/><rect x="3" y="9" width="18" height="6" rx="1"/>',
  };
  const ACCOUNT_ICONS = {
    bank: 'landmark', alipay: 'wallet', wechat: 'smartphone', cash: 'banknote',
    business: 'briefcase', liability: 'shield-alert', ebank: 'landmark', card: 'credit-card',
    campus: 'user', stock: 'trending-up', invest: 'trending-up', security: 'shield-alert',
  };
  const accountIcon = (type) => ACCOUNT_ICONS[type] || 'wallet';
  const CATEGORY_ICONS = {
    family: 'user', business: 'briefcase', study: 'graduation', parttime: 'briefcase',
    life: 'receipt', education: 'graduation', liability: 'shield-alert',
    transport: 'transport', medical: 'medical', saving: 'refresh-cw',
  };
  const categoryIcon = (cat) => (cat && (cat.icon || CATEGORY_ICONS[cat.category])) || 'receipt';
  const icon = (name, cls) =>
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"${cls ? ` class="${cls}"` : ''} aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;

  const chartTheme = () => {
    return { text: '#4a5a74', tick: '#8694ab', grid: 'rgba(29,78,137,.06)', title: '#4a5a74' };
  };

  const CHART_COLORS = ['#0f5132', '#ff7d00', '#00b96b', '#ff4d4f', '#9254de', '#13c2c2', '#faad14', '#eb2f96', '#0c3d27', '#36cfc9'];
  const chartColors = (n) => {
    const out = [];
    const len = n || CHART_COLORS.length;
    for (let i = 0; i < len; i++) out.push(CHART_COLORS[i % CHART_COLORS.length]);
    return out;
  };
  const colorFor = (i) => CHART_COLORS[((i % CHART_COLORS.length) + CHART_COLORS.length) % CHART_COLORS.length];
  const printView = () => { try { window.print(); } catch (e) {} };

  // 中国大陆主要银行 BIN(卡号前 6 位)→发卡行简称(银联公开号段, 用于 OCR 后自动识别)
  const BIN_BANKS = {
    '622576': '招商银行', '622577': '招商银行', '622578': '招商银行', '622579': '招商银行',
    '518710': '招商银行', '518718': '招商银行', '436745': '招商银行', '436748': '招商银行',
    '552245': '招商银行', '451289': '招商银行', '356889': '招商银行',
    '621785': '建设银行', '436718': '建设银行', '436742': '建设银行', '453242': '建设银行',
    '544887': '建设银行', '622280': '建设银行', '356833': '建设银行',
    '622200': '工商银行', '622202': '工商银行', '622203': '工商银行', '622700': '工商银行',
    '622708': '工商银行', '955880': '工商银行', '524091': '工商银行', '458060': '工商银行',
    '622848': '中国银行', '622752': '中国银行', '622753': '中国银行', '622755': '中国银行',
    '456351': '中国银行', '456352': '中国银行', '518377': '中国银行', '518378': '中国银行',
    '622845': '农业银行', '622846': '农业银行', '622847': '农业银行', '463758': '农业银行',
    '519412': '农业银行', '520083': '农业银行', '552599': '农业银行',
    '622260': '交通银行', '622261': '交通银行', '622262': '交通银行', '521899': '交通银行',
    '601428': '交通银行', '458123': '交通银行',
    '622188': '邮储银行', '621098': '邮储银行', '955100': '邮储银行', '620062': '邮储银行',
    '622516': '浦发银行', '622517': '浦发银行', '622518': '浦发银行', '622520': '浦发银行',
    '843800': '浦发银行', '843801': '浦发银行',
    '622616': '民生银行', '622617': '民生银行', '622618': '民生银行', '622619': '民生银行',
    '377153': '民生银行', '377155': '民生银行',
    '622902': '兴业银行', '622903': '兴业银行', '622904': '兴业银行', '451239': '兴业银行',
    '622690': '中信银行', '622691': '中信银行', '622692': '中信银行', '376968': '中信银行',
    '376969': '中信银行', '664900': '中信银行',
    '622986': '平安银行', '622989': '平安银行', '531659': '平安银行', '356868': '平安银行',
    '622660': '光大银行', '622661': '光大银行', '622662': '光大银行', '356837': '光大银行',
    '356838': '光大银行', '628261': '光大银行',
    '622636': '华夏银行', '622637': '华夏银行', '622638': '华夏银行', '539867': '华夏银行',
    '622568': '广发银行', '622569': '广发银行', '520152': '广发银行', '548844': '广发银行',
    '622172': '上海银行', '622173': '上海银行', '622985': '上海银行',
    '602969': '北京银行', '621030': '北京银行', '422160': '北京银行',
    '622384': '恒丰银行', '622389': '恒丰银行',
    '622325': '渤海银行', '622335': '渤海银行',
    '621778': '南京银行', '622777': '南京银行',
    '622129': '宁波银行', '622281': '宁波银行',
  };
  const lookupBank = (cardNumber) => {
    if (!cardNumber) return '';
    const digits = String(cardNumber).replace(/\D/g, '');
    if (digits.length < 6) return '';
    const bin6 = digits.slice(0, 6);
    if (BIN_BANKS[bin6]) return BIN_BANKS[bin6];
    const bin4 = digits.slice(0, 4);
    for (const k of Object.keys(BIN_BANKS)) if (k.startsWith(bin4)) return BIN_BANKS[k];
    return '';
  };
  const formatCardNumber = (digits) => {
    const d = String(digits || '').replace(/\D/g, '');
    return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };
  const maskCardNumber = (cardNumber) => {
    const d = String(cardNumber || '').replace(/\D/g, '');
    if (d.length < 8) return d ? '**** ' + d.slice(-4) : '';
    return d.slice(0, 4) + ' **** **** ' + d.slice(-4);
  };

  return {
    fmtMoney, fmtMoneyCompact, fmtMoneyChange,
    fmtDate, fmtDateTime, fmtTime, fmtMonth, fmtRelativeTime,
    todayMonth, monthRange, monthLabel,
    uid, $, $$, escapeHtml, toast, modal, confirm, literatiWelcome, debounce, hash, download, toCSV,
    chartTheme, icon, accountIcon, categoryIcon, CHART_COLORS, chartColors, colorFor, printView,
    lookupBank, formatCardNumber, maskCardNumber,
  };
})();
