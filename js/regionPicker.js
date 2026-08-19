/* =========================================================
   RegionPicker — 省/市/区 级联选择弹层(portal 到 body, position:fixed)
   用法:
     RegionPicker.open({
       trigger: el,                     // 触发元素(显示选中值的 input/div)
       value: '北京市/朝阳区',          //  当前值(可省)
       onSelect: function(addr, ids) { // 选中回调: addr='北京市/北京市/朝阳区'
         // ids = { province:'北京市', city:'北京市', district:'朝阳区' }
       },
       onClear: function() {}           // 清空回调
     });
   设计与分类级联一致: position:fixed + z-index 1100, 矮窗口可滚动
   ========================================================= */
const RegionPicker = (() => {
  let pop = null, state = null;

  function ensurePop() {
    if (pop) return pop;
    pop = document.createElement('div');
    pop.className = 'region-picker';
    document.body.appendChild(pop);
    return pop;
  }

  function close() {
    if (pop) { pop.classList.remove('open'); pop.innerHTML = ''; state = null; }
    document.removeEventListener('scroll', onScrollClose, true);
    window.removeEventListener('resize', onScrollClose);
  }
  function onScrollClose(e) {
    // 滚的是 picker 自身则不关; 其它滚动关
    if (pop && pop.contains(e.target)) return;
    close();
  }

  function render() {
    const P = window.REGIONS || [];
    const pIdx = state.provinces.findIndex(p => p.name === state.sel.province);
    const cityIdx = pIdx >= 0 ? state.provinces[pIdx].cities.findIndex(c => c.name === state.sel.city) : -1;
    const districts = (pIdx >= 0 && cityIdx >= 0) ? (state.provinces[pIdx].cities[cityIdx].districts || []) : [];

    pop.innerHTML = `
      <div class="rp-col">
        <div class="rp-col-head">${state.provinces.find(p => p.name === state.sel.province) ? state.sel.province : '请选择省份'}</div>
        <div class="rp-list">
          ${state.provinces.map((p, i) => `
            <div class="rp-opt ${i === pIdx ? 'sel' : ''}" data-pi="${i}">${p.name}</div>
          `).join('')}
        </div>
      </div>
      <div class="rp-col">
        <div class="rp-col-head">${pIdx >= 0 ? (state.sel.city || '请选择城市') : '请先选省份'}</div>
        <div class="rp-list">
          ${pIdx >= 0 ? state.provinces[pIdx].cities.map((c, i) => `
            <div class="rp-opt ${i === cityIdx ? 'sel' : ''}" data-ci="${i}">${c.name}</div>
          `).join('') : ''}
        </div>
      </div>
      <div class="rp-col">
        <div class="rp-col-head">${cityIdx >= 0 ? (state.sel.district || '请选择区/县') : (pIdx >= 0 ? '请先选城市' : '请先选省份')}</div>
        <div class="rp-list">
          ${districts.length ? districts.map(d => `
            <div class="rp-opt ${d === state.sel.district ? 'sel' : ''}" data-d="${d.replace(/"/g, '&quot;')}">${d}</div>
          `).join('') : (cityIdx >= 0 ? '<div class="rp-empty">该城市暂未收录区/县, 可直接用上两级</div>' : '')}
        </div>
      </div>
    `;
    // 事件
    pop.querySelectorAll('[data-pi]').forEach(el => el.addEventListener('click', () => {
      const i = +el.dataset.pi;
      state.sel = { province: state.provinces[i].name, city: '', district: '' };
      render();
      position();
    }));
    pop.querySelectorAll('[data-ci]').forEach(el => el.addEventListener('click', () => {
      const i = +el.dataset.ci;
      const p = state.provinces[pIdx];
      state.sel = { province: p.name, city: p.cities[i].name, district: '' };
      render();
      position();
    }));
    pop.querySelectorAll('[data-d]').forEach(el => el.addEventListener('click', () => {
      state.sel.district = el.dataset.d;
      render();
      commit();
    }));
  }

  function commit() {
    const s = state.sel;
    const addr = [s.province, s.city, s.district].filter(Boolean).join('/');
    if (state.onSelect) state.onSelect(addr, s);
    close();
  }

  function position() {
    if (!state || !state.trigger) return;
    const r = state.trigger.getBoundingClientRect();
    const popW = pop.offsetWidth || 540;
    let left = r.left, top = r.bottom + 6;
    if (left + popW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - popW - 8);
    if (top + 320 > window.innerHeight) top = Math.max(8, r.top - 320 - 6);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function open(opts) {
    const trigger = opts.trigger;
    if (!trigger || !window.REGIONS) return;
    // 解析现有值 '省/市/区'
    let sel = { province: '', city: '', district: '' };
    if (opts.value) {
      const parts = String(opts.value).split('/');
      sel.province = parts[0] || '';
      sel.city = parts[1] || '';
      sel.district = parts[2] || '';
    }
    state = {
      provinces: window.REGIONS,
      sel, trigger, onSelect: opts.onSelect, onClear: opts.onClear
    };
    const p = ensurePop();
    p.classList.add('open');
    render();
    position();
    document.addEventListener('scroll', onScrollClose, true);
    window.addEventListener('resize', onScrollClose);
  }

  return { open: open, close: close };
})();
window.RegionPicker = RegionPicker;