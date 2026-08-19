/* =========================================================
   View: 设置
   ========================================================= */

const SettingsView = (() => {

  function render(view) {
    const settings = Data.getSettings();
    const username = Data.getCurrentUser();
    const totals = Data.totals();

    view.innerHTML = `
      <div style="max-width:760px; margin:0 auto;">

        <div class="card" style="margin-bottom:16px;">
          <div class="card-title"><div class="card-title-text">${Util.icon('settings', 'card-title-icon')} ${I18n.t('语言')} / Language</div></div>
          <div class="setting-section" style="border:0;">
            <div class="setting-row">
              <div class="setting-row-info">
                <div class="setting-row-title">${I18n.t('语言')}</div>
                <div class="setting-row-desc">${I18n.t('切换界面显示语言')}</div>
              </div>
              <div class="lang-seg" id="settings-lang">
                <button type="button" class="lang-btn" data-lang="zh">中文</button>
                <button type="button" class="lang-btn" data-lang="en">English</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-title"><div class="card-title-text">${Util.icon('download', 'card-title-icon')} ${I18n.t('安装到手机')}</div></div>
          <div class="setting-section" style="border:0;">
            <div class="setting-row">
              <div class="setting-row-info">
                <div class="setting-row-title">${I18n.t('安装到手机主屏幕')}</div>
                <div class="setting-row-desc">${I18n.t('离线可用, 像原生 App 一样随时记账 (Android / iOS / 桌面)')}</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="window.__openInstallGuide()">${Util.icon('download')} ${I18n.t('安装')}</button>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-title"><div class="card-title-text">${Util.icon('map', 'card-title-icon')} ${I18n.t('第三方服务 · 高德地图')}</div></div>
          <div class="setting-section" style="border:0;">
            <div class="setting-row" style="flex-direction:column; align-items:stretch; gap:8px;">
              <div class="setting-row-info">
                <div class="setting-row-title">${I18n.t('高德地图 JS API Key')}</div>
                <div class="setting-row-desc">${I18n.t('用于交易地点 / 教育阶段地点的地图选点功能。免费申请:')} <a href="https://lbs.amap.com/" target="_blank" rel="noopener">lbs.amap.com</a> · ${I18n.t('JS API 2.0 需同时填下方"安全密钥"')}</div>
              </div>
              <div style="display:flex; gap:8px;">
                <input type="text" class="input" id="set-amap-key" value="${Util.escapeHtml(settings.amapKey || '')}" placeholder="${I18n.t('例如: 你的 JS API Key')}" style="flex:1;" />
                <button class="btn btn-primary btn-sm" id="set-amap-save">${I18n.t('保存')}</button>
              </div>
              <div style="display:flex; gap:8px; margin-top:8px;">
                <input type="text" class="input" id="set-amap-security" value="${Util.escapeHtml(settings.amapSecurity || '')}" placeholder="${I18n.t('安全密钥 (Security Code) · JS API 2.0 必填')}" style="flex:1;" />
              </div>
              <div id="amap-status" style="font-size:12px; color:var(--text-muted);">${(settings.amapKey && settings.amapSecurity) ? '✓ ' + I18n.t('已配置, 可在交易/教育阶段使用地图选点') : '⚠️ ' + I18n.t('未配置 Key + 安全密钥, 地图选点将降级为定位按钮')}</div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-title"><div class="card-title-text">${Util.icon('user', 'card-title-icon')} ${I18n.t('账户')}</div></div>
          <div class="setting-section" style="border:0;">
            <div class="setting-row">
              <div class="setting-row-info">
                <div class="setting-row-title">${I18n.t('当前用户')}</div>
                <div class="setting-row-desc">${Util.escapeHtml(username)} · ${I18n.t('数据仅存储在本地浏览器')}</div>
              </div>
              <div class="user-avatar" style="width:44px; height:44px; font-size:18px;">${(username || 'U').charAt(0).toUpperCase()}</div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-title"><div class="card-title-text">${Util.icon('lock', 'card-title-icon')} ${I18n.t('安全')}</div></div>
          <div class="setting-section" style="border:0;">
            <div class="setting-row">
              <div class="setting-row-info">
                <div class="setting-row-title">${I18n.t('修改密码')}</div>
                <div class="setting-row-desc">${I18n.t('定期更换密码,保护账户与本地数据安全')}</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="window.__changePassword()">${Util.icon('lock')} ${I18n.t('修改密码')}</button>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-title"><div class="card-title-text">${Util.icon('layers', 'card-title-icon')} ${I18n.t('数据管理')}</div></div>
          <div class="setting-section" style="border:0;">
            <div class="setting-row">
              <div class="setting-row-info">
                <div class="setting-row-title">${I18n.t('导出全部数据')}</div>
                <div class="setting-row-desc">${I18n.t('备份为 JSON 文件,可在其他设备导入')}</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="window.__exportData()">${Util.icon('download')} ${I18n.t('导出')}</button>
            </div>
            <div class="setting-row">
              <div class="setting-row-info">
                <div class="setting-row-title">${I18n.t('导入数据')}</div>
                <div class="setting-row-desc">${I18n.t('从备份文件恢复数据 (覆盖当前)')}</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="window.__importData()">${Util.icon('upload')} ${I18n.t('导入')}</button>
            </div>
            <div class="setting-row">
              <div class="setting-row-info">
                <div class="setting-row-title">${I18n.t('资产快照')}</div>
                <div class="setting-row-desc">${I18n.t('总资产')} ${Util.fmtMoney(totals.totalAssets)} · ${I18n.t('总负债')} ${Util.fmtMoney(totals.totalLiabilities)} · ${I18n.t('净资产')} ${Util.fmtMoney(totals.netAssets)}</div>
              </div>
              <span class="chip chip-brand">${I18n.t('实时')}</span>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-title"><div class="card-title-text">${Util.icon('shield-alert', 'card-title-icon')} ${I18n.t('危险操作')}</div></div>
          <div class="setting-section" style="border:0;">
            <div class="setting-row">
              <div class="setting-row-info">
                <div class="setting-row-title" style="color:var(--up)">${I18n.t('一键清空演示数据')}</div>
                <div class="setting-row-desc">${I18n.t('清空全部账户、交易、存钱罐、负债等,仅保留当前账户,方便录入您自己的数据')}</div>
              </div>
              <button class="btn btn-danger btn-sm" onclick="window.__clearDemoData()">${I18n.t('清空')}</button>
            </div>
            <div class="setting-row">
              <div class="setting-row-info">
                <div class="setting-row-title" style="color:var(--up)">${I18n.t('清空所有数据')}</div>
                <div class="setting-row-desc">${I18n.t('删除全部数据并恢复为演示数据')}</div>
              </div>
              <button class="btn btn-danger btn-sm" onclick="window.__resetData()">${I18n.t('清空')}</button>
            </div>
            <div class="setting-row">
              <div class="setting-row-info">
                <div class="setting-row-title" style="color:var(--up)">${I18n.t('退出登录')}</div>
                <div class="setting-row-desc">${I18n.t('返回登录界面')}</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="window.__logout()">${I18n.t('退出')}</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title"><div class="card-title-text">${Util.icon('info', 'card-title-icon')} ${I18n.t('关于')}</div></div>
          <div class="setting-section" style="border:0; font-size:13px; color:var(--text-muted); line-height:2;">
            <div><strong style="color:var(--text)">${I18n.t('个人金融系统')}</strong> · ${I18n.t('学生 & 创业 资金全路径管理系统')}</div>
            <div>${I18n.t('版本 v1.0.0 · 本地存储架构 · 数据完全自主可控')}</div>
            <div>${I18n.t('基于完整设计方案 V2.0 实现,包含 12 大功能模块')}</div>
          </div>
        </div>
      </div>
    `;

    // 高德地图 Key + 安全密钥 保存
    const amapSave = document.getElementById('set-amap-save');
    if (amapSave) {
      amapSave.addEventListener('click', () => {
        const v = (document.getElementById('set-amap-key').value || '').trim();
        const sec = (document.getElementById('set-amap-security').value || '').trim();
        Data.updateSettings({ amapKey: v, amapSecurity: sec });
        Util.toast(v && sec ? '✓ 已保存高德地图 Key + 安全密钥' : (v ? '✓ 已保存, 但缺安全密钥地图仍不可用' : '已清空高德地图配置'), 'success');
        const status = document.getElementById('amap-status');
        if (status) status.innerHTML = (v && sec) ? '✓ 已配置, 可在交易/教育阶段使用地图选点' : '⚠️ 未配置 Key + 安全密钥, 地图选点将降级为定位按钮';
      });
    }
  }

  window.__exportData = () => {
    const json = Data.exportAll();
    Util.download(`Will财务管理系统备份_${Util.fmtDate(Date.now())}.json`, json, 'application/json');
    Util.toast(I18n.t('数据已导出'), 'success');
  };

  window.__importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Data.importAll(reader.result);
          Util.toast(I18n.t('数据已导入,正在刷新…'), 'success');
          setTimeout(() => { location.reload(); }, 600);
        } catch (err) {
          Util.toast(I18n.t('导入失败: 文件格式错误'), 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  window.__clearDemoData = async () => {
    const ok = await Util.confirm(I18n.t('一键清空演示数据'), I18n.t('将清空全部账户、交易、存钱罐、负债等数据,仅保留当前账户。确定继续?'), { okText: I18n.t('是'), cancelText: I18n.t('否'), danger: true });
    if (ok) {
      Data.clearDemoData();
      Util.toast(I18n.t('已清空数据,可开始录入您自己的数据'), 'success');
      render(document.getElementById('view'));
    }
  };

  window.__resetData = async () => {
    const ok = await Util.confirm(I18n.t('清空数据'), I18n.t('将删除全部数据并重新生成演示数据,确定继续?'), { okText: I18n.t('是'), cancelText: I18n.t('否'), danger: true });
    if (ok) {
      const user = Data.getCurrentUser();
      Data.clear();
      Data.load(user);
      Data.seedDemoData();
      Util.toast(I18n.t('已重置为演示数据'), 'success');
      render(document.getElementById('view'));
    }
  };

  window.__logout = () => {
    Auth.logout();
    location.reload();
  };

  window.__changePassword = () => {
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="form-group"><label>${I18n.t('原密码')}</label><input type="password" class="input" id="cp-old" placeholder="${I18n.t('请输入当前密码')}" autocomplete="current-password" /></div>
      <div class="form-group"><label>${I18n.t('新密码')}</label><input type="password" class="input" id="cp-new" placeholder="${I18n.t('至少 6 位')}" autocomplete="new-password" minlength="6" /></div>
      <div class="form-group"><label>${I18n.t('确认新密码')}</label><input type="password" class="input" id="cp-confirm" placeholder="${I18n.t('再次输入新密码')}" autocomplete="new-password" minlength="6" /></div>
    `;
    Util.modal({
      title: I18n.t('修改密码'),
      body,
      footer: `<button class="btn btn-ghost" data-act="close">${I18n.t('取消')}</button><button class="btn btn-primary" id="cp-save">${I18n.t('保存')}</button>`,
    });
    document.getElementById('cp-save').addEventListener('click', () => {
      const oldP = document.getElementById('cp-old').value;
      const newP = document.getElementById('cp-new').value;
      const conf = document.getElementById('cp-confirm').value;
      if (!oldP) { Util.toast(I18n.t('请输入原密码'), 'warn'); return; }
      if (newP !== conf) { Util.toast(I18n.t('两次新密码不一致'), 'warn'); return; }
      const res = Auth.changePassword(oldP, newP);
      if (!res.ok) { Util.toast(res.error, 'error'); return; }
      Util.toast(I18n.t('密码已修改'), 'success');
      // 同步把云端账号密码改成"新密码派生的 token", 保持跨设备可登录
      if (window.Sync && Sync.migratePassword) Sync.migratePassword(oldP, newP);
      document.querySelector('.modal-mask')?.remove();
    });
  };

  return { render };
})();
