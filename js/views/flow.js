/* =========================================================
   View: 资金流向 (桑基图)
   ========================================================= */

const FlowView = (() => {

  function render(view) {
    const txs = Data.getTransactions();
    const cats = Data.getCategories();
    const accounts = Data.getAccounts();

    // 本月
    const ym = Util.todayMonth();
    const [start, end] = Util.monthRange(ym);

    // 三阶: 来源(收入分类) → 账户 → 去向(支出分类)
    // Nodes
    const incomeCats = cats.filter(c => c.type === 'income');
    const expenseCats = cats.filter(c => c.type === 'expense');

    // 计算链接
    const incomeLinks = []; // source cat -> account
    const expenseLinks = []; // account -> cat

    txs.filter(t => t.time >= start && t.time < end).forEach(t => {
      const cat = cats.find(c => c.id === t.categoryId);
      const acc = accounts.find(a => a.id === t.accountId);
      if (t.type === 'income' && cat && acc) {
        const link = incomeLinks.find(l => l.source === cat.id && l.target === acc.id);
        if (link) link.value += t.amount; else incomeLinks.push({ source: cat.id, target: acc.id, value: t.amount });
      } else if (t.type === 'expense' && cat && acc) {
        const link = expenseLinks.find(l => l.source === acc.id && l.target === cat.id);
        if (link) link.value += t.amount; else expenseLinks.push({ source: acc.id, target: cat.id, value: t.amount });
      }
    });

    const totalIncome = incomeLinks.reduce((s, l) => s + l.value, 0);
    const totalExpense = expenseLinks.reduce((s, l) => s + l.value, 0);

    view.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <div style="font-size:16px; font-weight:700;">${Util.monthLabel(ym)} · ${I18n.t('资金流向')}</div>
        </div>
        <div class="toolbar-right">
          <div class="legend-row" style="font-size:12px;">
            <span><span class="legend-dot" style="background:#163e6e"></span>${I18n.t('收入来源')}</span>
            <span><span class="legend-dot" style="background:#2f6cab"></span>${I18n.t('资金账户')}</span>
            <span><span class="legend-dot" style="background:#5b9bd5"></span>${I18n.t('支出去向')}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <div class="card-title-text">
            ${Util.icon('git-branch','card-title-icon')}
            ${I18n.t('资金来源 → 账户 → 支出去向 桑基图')}
          </div>
        </div>
        <div class="sankey-wrap" id="sankey"></div>
      </div>

      <div class="dash-row">
        <div class="card">
          <div class="card-title"><div class="card-title-text">${Util.icon('arrow-down', 'card-title-icon')} ${I18n.t('收入来源构成')}</div></div>
          <div id="income-stat"></div>
        </div>
        <div class="card">
          <div class="card-title"><div class="card-title-text">${Util.icon('arrow-up', 'card-title-icon')} ${I18n.t('支出去向构成')}</div></div>
          <div id="expense-stat"></div>
        </div>
      </div>
    `;

    renderSankey(incomeCats, accounts, expenseCats, incomeLinks, expenseLinks);
    renderStats('income-stat', incomeLinks, (l) => cats.find(c => c.id === l.source)?.name || '?', totalIncome, '#163e6e');
    renderStats('expense-stat', expenseLinks, (l) => cats.find(c => c.id === l.target)?.name || '?', totalExpense, '#5b9bd5');
  }

  function renderStats(id, links, getName, total, color) {
    const el = document.getElementById(id);
    if (!el) return;
    const byName = {};
    links.forEach(l => {
      const name = getName(l);
      byName[name] = (byName[name] || 0) + l.value;
    });
    const arr = Object.entries(byName).sort((a, b) => b[1] - a[1]);
    if (!arr.length) { el.innerHTML = `<div class="empty"><div class="empty-desc">${I18n.t('暂无数据')}</div></div>`; return; }
    el.innerHTML = arr.map(([name, val]) => {
      const r = val / Math.max(1, arr[0][1]);
      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
            <span>${Util.escapeHtml(name)}</span>
            <span style="font-weight:600;">${Util.fmtMoney(val)}</span>
          </div>
          <div class="gauge-bar"><div class="gauge-fill" style="width:${Math.max(4, r * 100)}%; background:${color};"></div></div>
        </div>
      `;
    }).join('');
  }

  function renderSankey(incomeCats, accounts, expenseCats, incomeLinks, expenseLinks) {
    const container = document.getElementById('sankey');
    if (!container) return;

    const W = 920, H = 460;
    const padTop = 20, padBottom = 20;
    const colX = [40, W / 2 - 30, W - 150];

    // Build nodes for 3 columns
    const leftNodes = incomeCats.map(c => ({ id: 'i_' + c.id, name: c.name, icon: c.icon, color: c.color || '#163e6e', value: 0, col: 0 }));
    const midNodes = accounts.filter(a => a.type !== 'liability').map(a => ({ id: 'a_' + a.id, name: a.name, icon: a.icon, color: a.color || '#2f6cab', value: 0, col: 1 }));
    const rightNodes = expenseCats.map(c => ({ id: 'e_' + c.id, name: c.name, icon: c.icon, color: c.color || '#5b9bd5', value: 0, col: 2 }));

    // helper maps
    const nodeMap = {};
    [...leftNodes, ...midNodes, ...rightNodes].forEach(n => nodeMap[n.id] = n);

    // assign values
    incomeLinks.forEach(l => { const s = nodeMap['i_' + l.source]; const t = nodeMap['a_' + l.target]; if (s) s.value += l.value; if (t) t.value += l.value; });
    expenseLinks.forEach(l => { const s = nodeMap['a_' + l.source]; const t = nodeMap['e_' + l.target]; if (s) s.value += l.value; if (t) t.value += l.value; });

    // filter out empty nodes
    const usableLeft = leftNodes.filter(n => n.value > 0);
    const usableMid = midNodes.filter(n => n.value > 0);
    const usableRight = rightNodes.filter(n => n.value > 0);

    if (!usableLeft.length || !usableRight.length) {
      container.innerHTML = '<div class="empty"><div class="empty-icon">' + Util.icon('arrow-left-right') + '</div><div class="empty-title">' + I18n.t('暂无资金流向数据') + '</div><div class="empty-desc">' + I18n.t('本月还没有足够的收支记录') + '</div></div>';
      return;
    }

    // layout: assign y positions
    const scale = (nodes, x) => {
      const totalVal = nodes.reduce((s, n) => s + n.value, 0);
      const availH = H - padTop - padBottom;
      const gap = 14;
      const totalGap = gap * (nodes.length - 1);
      const scaleFactor = (availH - totalGap) / Math.max(1, totalVal);
      let y = padTop;
      nodes.forEach(n => {
        n.h = n.value * scaleFactor;
        n.y0 = y;
        n.y1 = y + n.h;
        n.x = x;
        y += n.h + gap;
      });
    };
    scale(usableLeft, colX[0]);
    scale(usableMid, colX[1]);
    scale(usableRight, colX[2]);

    // draw links
    const linkPath = (sNode, tNode, sY, tY) => {
      const x0 = sNode.x + 140, x1 = tNode.x;
      const mx = (x0 + x1) / 2;
      return `M${x0},${sY} C${mx},${sY} ${mx},${tY} ${x1},${tY}`;
    };

    function drawColumnLinks(links, srcPrefix, tgtPrefix, getSrcId, getTgtId) {
      let svg = '';
      const srcOffset = {}, tgtOffset = {};
      links.forEach(l => {
        const sId = srcPrefix + getSrcId(l);
        const tId = tgtPrefix + getTgtId(l);
        const s = nodeMap[sId], t = nodeMap[tId];
        if (!s || !t) return;
        srcOffset[sId] = srcOffset[sId] || s.y0;
        tgtOffset[tId] = tgtOffset[tId] || t.y0;
        const linkH = Math.max(1.5, (l.value / Math.max(1, s.value)) * s.h);
        const tLinkH = Math.max(1.5, (l.value / Math.max(1, t.value)) * t.h);
        const sY = srcOffset[sId];
        const tY = tgtOffset[tId];
        srcOffset[sId] += linkH;
        tgtOffset[tId] += tLinkH;
        svg += `<path d="${linkPath(s, t, sY + linkH / 2, tY + tLinkH / 2)}" stroke="${s.color}" stroke-width="${Math.max(1.5, tLinkH)}" fill="none" stroke-opacity="0.35" class="flow-link"/>`;
      });
      return svg;
    }

    let svgLinks = '';
    svgLinks += drawColumnLinks(incomeLinks, 'i_', 'a_', l => l.source, l => l.target);
    svgLinks += drawColumnLinks(expenseLinks, 'a_', 'e_', l => l.source, l => l.target);

    function nodeRect(n) {
      const w = 140;
      return `
        <g>
          <rect x="${n.x}" y="${n.y0}" width="${w}" height="${Math.max(2, n.h)}" rx="3" fill="${n.color}" />
          <text x="${n.x + 6}" y="${n.y0 + Math.min(n.h, 22) / 2 + 4}" fill="#fff" font-size="11" font-weight="600">${(n.icon || '')} ${Util.escapeHtml(n.name.length > 8 ? n.name.slice(0, 8) : n.name)}</text>
          <text x="${n.x + w - 6}" y="${n.y0 + Math.min(n.h, 22) / 2 + 4}" fill="rgba(255,255,255,.7)" font-size="10" text-anchor="end">${Util.fmtMoneyCompact(n.value)}</text>
        </g>
      `;
    }
    let svgNodes = '';
    [...usableLeft, ...usableMid, ...usableRight].forEach(n => { svgNodes += nodeRect(n); });

    container.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto; font-family:Inter,sans-serif;">
        ${svgLinks}
        ${svgNodes}
      </svg>
      <style>
        .flow-link { transition: stroke-opacity .2s; }
        .flow-link:hover { stroke-opacity: .7 !important; }
      </style>
    `;
  }

  return { render };
})();
