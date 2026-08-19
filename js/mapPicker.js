/* =========================================================
   mapPicker.js — 地图选择器 (高德 Amap) v40+
   - 设置里有 amapKey 时:动态加载 webapi.amap.com,初始化 AMap.Map
   - 无 key 时:降级为 📍 geolocation 按钮 + 手动地址输入
   - 复用 Util.modal,点击地图/确认后回调 {lat,lng,address}
   ========================================================= */
(function () {
  let amapLoading = null;  // Promise 单例,避免重复注入
  function loadAmap(key, security) {
    if (window.AMap) return Promise.resolve(window.AMap);
    if (amapLoading) return amapLoading;
    // 高德 JS API 2.0 强制要求: 必须在加载脚本前设置安全密钥, 否则报 INVALID_USER_SCODE 地图无法渲染
    if (security) window._AMapSecurityConfig = { securityJsCode: security };
    amapLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://webapi.amap.com/maps?v=2.0&key=' + encodeURIComponent(key) + '&plugin=AMap.Geocoder,AMap.ToolBar,AMap.Marker';
      s.async = true;
      s.onload = () => resolve(window.AMap);
      s.onerror = () => reject(new Error('高德地图脚本加载失败'));
      document.head.appendChild(s);
    });
    return amapLoading;
  }

  /**
   * Util.openMapPicker({ initial:{lat,lng,address}, onSelect }) → Promise<{lat,lng,address}>
   * 暴露在 Util 上方便各模块调用。
   */
  async function openMapPicker(opts) {
    opts = opts || {};
    const initial = opts.initial || {};
    const settings = (typeof Data !== 'undefined' && Data.getSettings) ? Data.getSettings() : {};
    const key = settings.amapKey || '';
    const security = settings.amapSecurity || '';
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="map-picker">
        ${key ? '' : '<div class="map-picker-warn">⚠️ 未配置高德地图 Key,无法使用可视化地图。<br/>请到「设置 → 第三方服务」中填入高德 Web 端 JS API Key(免费申请:<a href="https://lbs.amap.com/" target="_blank">lbs.amap.com</a>)。</div>'}
        <div class="map-picker-search">
          <input type="text" class="input" id="mp-addr" placeholder="搜索地址(如:北京 天安门)" value="${(initial.address || '').replace(/"/g, '&quot;')}" />
          <button class="btn btn-ghost" id="mp-search-btn" type="button">🔍 搜索</button>
          <button class="btn btn-ghost" id="mp-locate-btn" type="button">📍 当前位置</button>
        </div>
        <div id="mp-map" class="map-picker-map" style="height:360px;${key ? '' : 'display:none;'}"></div>
        <div class="map-picker-fallback" style="${key ? 'display:none;' : ''}">
          <div class="form-group"><label>地址(手动填写)</label>
            <input type="text" class="input" id="mp-addr-fallback" value="${(initial.address || '').replace(/"/g, '&quot;')}" placeholder="例:北京市朝阳区建国门外大街 1 号" /></div>
          <div class="form-grid-2">
            <div class="form-group"><label>纬度</label><input type="number" step="0.000001" class="input" id="mp-lat-fallback" value="${initial.lat || ''}" /></div>
            <div class="form-group"><label>经度</label><input type="number" step="0.000001" class="input" id="mp-lng-fallback" value="${initial.lng || ''}" /></div>
          </div>
        </div>
        <div class="map-picker-status" id="mp-status"></div>
      </div>
    `;
    const footer = `
      <button class="btn btn-ghost" data-act="close">取消</button>
      <button class="btn btn-primary" id="mp-confirm">✓ 确认选择</button>
    `;
    const closePromise = Util.modal({ title: opts.title || '选择地点', body, footer, size: 'large' });
    const status = body.querySelector('#mp-status');
    let picked = { lat: initial.lat, lng: initial.lng, address: initial.address || '' };
    let map = null, marker = null, geocoder = null;

    function setStatus(msg, kind) {
      if (!status) return;
      status.textContent = msg || '';
      status.className = 'map-picker-status ' + (kind || '');
    }

    if (key) {
      if (!security) setStatus('⚠️ 高德 JS API 2.0 需要"安全密钥",请到「设置 → 第三方服务」补充', 'warn');
      try {
        const AMap = await loadAmap(key, security);
        const center = (initial.lat && initial.lng) ? [initial.lng, initial.lat] : [116.397428, 39.90923];
        map = new AMap.Map(body.querySelector('#mp-map'), {
          center, zoom: 13, viewMode: '2D',
        });
        map.addControl(new AMap.ToolBar());
        geocoder = new AMap.Geocoder({ city: '全国' });
        if (initial.lat && initial.lng) placeMarker(initial.lng, initial.lat);
        map.on('click', (e) => {
          const lng = e.lnglat.getLng(), lat = e.lnglat.getLat();
          placeMarker(lng, lat);
          reverseGeocode(lng, lat);
        });
        function placeMarker(lng, lat) {
          if (marker) marker.setMap(null);
          marker = new AMap.Marker({ position: [lng, lat], map });
          picked.lat = lat; picked.lng = lng;
        }
        function reverseGeocode(lng, lat) {
          setStatus('🔄 正在解析地址...', '');
          geocoder.getAddress([lng, lat], (statusCode, result) => {
            if (statusCode === 'complete' && result.regeocodes && result.regeocodes[0]) {
              const a = result.regeocodes[0].formattedAddress;
              picked.address = a;
              body.querySelector('#mp-addr').value = a;
              setStatus('✓ 已定位: ' + a, 'ok');
            } else {
              setStatus('⚠️ 地址解析失败,请手动输入', 'warn');
            }
          });
        }
      } catch (e) {
        setStatus('❌ 高德地图加载失败: ' + e.message, 'error');
      }
    }

    // 搜索按钮
    body.querySelector('#mp-search-btn').addEventListener('click', () => {
      const q = body.querySelector('#mp-addr').value.trim();
      if (!q) { setStatus('请输入地址', 'warn'); return; }
      if (!key) { picked.address = q; setStatus('✓ 已记录: ' + q, 'ok'); return; }
      if (!geocoder) { setStatus('地图未就绪', 'warn'); return; }
      setStatus('🔄 搜索中...', '');
      geocoder.getLocation(q, (statusCode, result) => {
        if (statusCode === 'complete' && result.geocodes && result.geocodes[0]) {
          const loc = result.geocodes[0].location;
          const lng = loc.getLng(), lat = loc.getLat();
          map.setCenter([lng, lat]); map.setZoom(15);
          if (marker) marker.setMap(null);
          marker = new AMap.Marker({ position: [lng, lat], map });
          picked = { lat, lng, address: result.geocodes[0].formattedAddress || q };
          body.querySelector('#mp-addr').value = picked.address;
          setStatus('✓ 找到: ' + picked.address, 'ok');
        } else {
          setStatus('❌ 未找到: ' + q, 'error');
        }
      });
    });

    // 当前位置按钮
    body.querySelector('#mp-locate-btn').addEventListener('click', () => {
      if (!navigator.geolocation) { setStatus('❌ 浏览器不支持定位', 'error'); return; }
      setStatus('🔄 正在获取位置...', '');
      navigator.geolocation.getCurrentPosition((pos) => {
        const lng = pos.coords.longitude, lat = pos.coords.latitude;
        if (key && map) {
          map.setCenter([lng, lat]); map.setZoom(15);
          if (marker) marker.setMap(null);
          marker = new AMap.Marker({ position: [lng, lat], map });
        }
        picked.lat = lat; picked.lng = lng;
        // 写回 fallback 字段
        const latF = body.querySelector('#mp-lat-fallback'); if (latF) latF.value = lat;
        const lngF = body.querySelector('#mp-lng-fallback'); if (lngF) lngF.value = lng;
        if (key && geocoder) reverseGeocode(lng, lat);
        else setStatus('✓ 已获取坐标,请填写地址', 'ok');
      }, (err) => setStatus('❌ 定位失败: ' + err.message, 'error'), { enableHighAccuracy: true, timeout: 10000 });
    });

    // 手动输入 fallback 同步
    if (!key) {
      ['mp-addr-fallback', 'mp-lat-fallback', 'mp-lng-fallback'].forEach(id => {
        const el = body.querySelector('#' + id);
        if (el) el.addEventListener('input', () => {
          picked.address = body.querySelector('#mp-addr-fallback').value;
          const la = parseFloat(body.querySelector('#mp-lat-fallback').value);
          const ln = parseFloat(body.querySelector('#mp-lng-fallback').value);
          if (!isNaN(la)) picked.lat = la;
          if (!isNaN(ln)) picked.lng = ln;
        });
      });
    } else {
      // key 模式下也同步搜索框的 input
      const addrInput = body.querySelector('#mp-addr');
      addrInput.addEventListener('change', () => { picked.address = addrInput.value; });
    }

    // 确认(#mp-confirm 在 modal footer 中, 须从 document 取, 不能从 body)
    document.getElementById('mp-confirm').addEventListener('click', () => {
      if (key) picked.address = body.querySelector('#mp-addr').value.trim() || picked.address;
      if (!picked.address) { setStatus('请填写或选择地址', 'warn'); return; }
      try { opts.onSelect && opts.onSelect(picked); } catch (e) { console.error(e); }
      const mask = document.querySelector('.modal-mask');
      if (mask) mask.remove();
      closePromise.resolve && closePromise.resolve(picked);
    });

    return new Promise((resolve) => { closePromise.resolve = resolve; });
  }

  // 挂到 Util
  if (typeof Util !== 'undefined') Util.openMapPicker = openMapPicker;
})();
