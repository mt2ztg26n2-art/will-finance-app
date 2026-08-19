/* =========================================================
   View: 区域消费热力图 (Region Spending Heatmap)
   - 聚合「带地点标签」的支出交易, 按省/市 着色热力方格
   - 工商红渐变: 浅 → 深 = 花费少 → 多
   - 点击省份 → 下钻到该省各城市
   ========================================================= */

const RegionHeatmapView = (() => {
  const BRAND = [199, 0, 11];

  function heatColor(ratio) {
    // ratio: 0..1
    const a = (0.06 + ratio * 0.94).toFixed(3);
    return `rgba(${BRAND[0]},${BRAND[1]},${BRAND[2]},${a})`;
  }
  function provinceKey(loc) {
    if (!loc) return null;
    if (loc.indexOf('/') >= 0) return loc.split('/')[0];
    return loc; // 自由文本省份
  }
  function cityKey(loc) {
    if (!loc || loc.indexOf('/') < 0) return null;
    const a = loc.split('/');
    return a[1] || null;
  }

  function render(view) {
    const state = { range: 'all', prov: null };

    function build() {
      const all = Data.getTransactions();
      let txs = all.filter(t => t.type === 'expense' && t.location);
      const now = Date.now();
      if (state.range === '30') txs = txs.filter(t => now - new Date(t.time).getTime() <= 30 * 864e5);
      else if (state.range === '90') txs = txs.filter(t => now - new Date(t.time).getTime() <= 90 * 864e5);

      const byProv = {};
      txs.forEach(t => {
        const p = provinceKey(t.location);
        if (!p) return;
        if (!byProv[p]) byProv[p] = { name: p, total: 0, count: 0 };
        byProv[p].total += Number(t.amount || 0);
        byProv[p].count++;
      });
      const provArr = Object.values(byProv).sort((a, b) => b.total - a.total);
      const maxTotal = provArr.length ? provArr[0].total : 0;
      const taggedTotal = provArr.reduce((s, p) => s + p.total, 0);

      // 城市下钻
      let cityArr = [];
      if (state.prov) {
        const cMap = {};
        txs.filter(t => provinceKey(t.location) === state.prov).forEach(t => {
          const c = cityKey(t.location) || I18n.t('未细分到市/区');
          if (!cMap[c]) cMap[c] = { name: c, total: 0, count: 0 };
          cMap[c].total += Number(t.amount || 0);
          cMap[c].count++;
        });
        cityArr = Object.values(cMap).sort((a, b) => b.total - a.total);
      }
      return { txs, provArr, maxTotal, taggedTotal, cityArr };
    }

    function paint() {
      const d = build();
      const R = window.REGIONS || [];
      const known = new Set(R.map(p => p.name));
      const provTiles = R.map(p => {
        const agg = d.provArr.find(x => x.name === p.name);
        return { name: p.name, total: agg ? agg.total : 0, count: agg ? agg.count : 0 };
      });
      const others = d.provArr.filter(p => !known.has(p.name));

      const kpi = `
        <div class="kpi-grid">
          <div class="kpi-card" style="--kpi-color:var(--brand)">
            <div class="kpi-label">${I18n.t('带地点标签支出')}</div>
            <div class="kpi-value">${Util.fmtMoney(d.taggedTotal)}</div>
            <div class="kpi-sub">${d.provArr.length} ${I18n.t('个省级区域')}</div>
          </div>
          <div class="kpi-card" style="--kpi-color:var(--brand)">
            <div class="kpi-label">${I18n.t('覆盖交易笔数')}</div>
            <div class="kpi-value">${d.txs.length}</div>
            <div class="kpi-sub">${I18n.t('仅支出类')}</div>
          </div>
          <div class="kpi-card" style="--kpi-color:var(--brand)">
            <div class="kpi-label">${I18n.t('花费最高省份')}</div>
            <div class="kpi-value">${d.provArr.length ? d.provArr[0].name.replace(/(省|市|自治区|特别行政区)$/, '') : '—'}</div>
            <div class="kpi-sub">${d.provArr.length ? Util.fmtMoney(d.provArr[0].total) : '—'}</div>
          </div>
          <div class="kpi-card" style="--kpi-color:var(--brand)">
            <div class="kpi-label">${I18n.t('平均单笔')}</div>
            <div class="kpi-value">${d.txs.length ? Util.fmtMoney(d.taggedTotal / d.txs.length) : '—'}</div>
            <div class="kpi-sub">${I18n.t('按标签交易')}</div>
          </div>
        </div>`;

      const rangeBar = `
        <div class="rh-range">
          <button class="rh-range-btn ${state.range === 'all' ? 'active' : ''}" data-range="all">${I18n.t('全部')}</button>
          <button class="rh-range-btn ${state.range === '90' ? 'active' : ''}" data-range="90">${I18n.t('近 90 天')}</button>
          <button class="rh-range-btn ${state.range === '30' ? 'active' : ''}" data-range="30">${I18n.t('近 30 天')}</button>
          <span class="rh-legend"><i class="rh-dot rh-dot-lo"></i>${I18n.t('少')}<i class="rh-dot rh-dot-hi"></i>${I18n.t('多')}</span>
        </div>`;

      const tileHtml = (t, isProv) => {
        const ratio = d.maxTotal > 0 ? t.total / d.maxTotal : 0;
        const bg = t.total > 0 ? heatColor(ratio) : 'var(--bg-3)';
        const fg = t.total > 0 && ratio > 0.5 ? '#fff' : 'var(--text)';
        return `<button class="rh-tile ${isProv ? 'rh-prov' : ''} ${state.prov === t.name ? 'sel' : ''}" data-name="${t.name.replace(/"/g, '&quot;')}" style="background:${bg};color:${fg}">
          <span class="rh-tile-name">${t.name.replace(/(省|市|自治区|特别行政区)$/, '')}</span>
          <span class="rh-tile-val">${t.total > 0 ? Util.fmtMoney(t.total) : (isProv ? '—' : '—')}</span>
          <span class="rh-tile-cnt">${t.count ? t.count + I18n.t('笔') : ''}</span>
        </button>`;
      };

      let gridHtml;
      if (d.provArr.length === 0) {
        gridHtml = `<div class="rh-empty">${I18n.t('暂无带地点标签的支出交易。在「记一笔」或「求学阶段」里用省/市/区级联选择地点后即可在此查看区域消费热力图。')}</div>`;
      } else {
        gridHtml = `<div class="rh-grid">${provTiles.map(t => tileHtml(t, true)).join('')}</div>`;
        if (others.length) {
          gridHtml += `<div class="rh-others-title">${I18n.t('其它地点(自由文本)')}</div><div class="rh-grid rh-grid-sm">${others.map(t => tileHtml(t, false)).join('')}</div>`;
        }
      }

      // 下钻面板
      let drillHtml = '';
      if (state.prov) {
        const provAgg = d.provArr.find(x => x.name === state.prov);
        const cityTiles = d.cityArr.map(c => {
          const maxC = d.cityArr.length ? d.cityArr[0].total : 0;
          const ratio = maxC > 0 ? c.total / maxC : 0;
          const bg = heatColor(ratio);
          const fg = ratio > 0.5 ? '#fff' : 'var(--text)';
          return `<div class="rh-city" style="background:${bg};color:${fg}">
            <span class="rh-city-name">${c.name.replace(/(区|县|市|区)$/, '')}</span>
            <span class="rh-city-val">${Util.fmtMoney(c.total)}</span>
            <span class="rh-city-cnt">${c.count + I18n.t('笔')}</span>
          </div>`;
        }).join('');
        drillHtml = `
          <div class="card rh-drill">
            <div class="rh-drill-head">
              <div>
                <div class="rh-drill-title">${state.prov.replace(/(省|市|自治区|特别行政区)$/, '')} · ${I18n.t('城市消费分布')}</div>
                <div class="rh-drill-sub">${provAgg ? Util.fmtMoney(provAgg.total) + ' · ' + provAgg.count + I18n.t('笔支出') : ''}</div>
              </div>
              <button class="btn btn-ghost btn-sm" id="rh-back">${I18n.t('返回全国')}</button>
            </div>
            <div class="rh-city-grid">${d.cityArr.length ? cityTiles : `<div class="rh-empty">${I18n.t('该省份暂无细分到城市的交易')}</div>`}</div>
          </div>`;
      }

      view.innerHTML = `
        <div class="page-header">
          <div class="page-header-ico" style="background:var(--brand-soft);color:var(--brand)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
          </div>
          <div class="page-header-text">
            <h1>${I18n.t('区域消费热力图')}</h1>
            <p>${I18n.t('按省/市聚合带地点标签的支出, 颜色越深花费越高')}</p>
          </div>
        </div>
        ${kpi}
        ${rangeBar}
        ${gridHtml}
        ${drillHtml}
      `;

      // 事件
      view.querySelectorAll('.rh-range-btn').forEach(b => b.addEventListener('click', () => { state.range = b.dataset.range; paint(); }));
      view.querySelectorAll('.rh-prov').forEach(b => b.addEventListener('click', () => {
        const name = b.dataset.name;
        state.prov = state.prov === name ? null : name;
        paint();
      }));
      const back = view.querySelector('#rh-back');
      if (back) back.addEventListener('click', () => { state.prov = null; paint(); });
    }

    paint();
  }

  return { render };
})();
window.RegionHeatmapView = RegionHeatmapView;
