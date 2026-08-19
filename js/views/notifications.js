/* =========================================================
   View: 通知中心
   ========================================================= */

const NotificationsView = (() => {

  const typeMeta = {
    budget: { icon: 'shield-alert', cls: 'budget', key: '预算' },
    debt: { icon: 'credit-card', cls: 'debt', key: '还款' },
    report: { icon: 'bar-chart', cls: 'report', key: '报告' },
    large: { icon: 'scale', cls: 'large', key: '大额' },
    system: { icon: 'bell', cls: 'system', key: '系统' },
  };

  function typeLabel(t) { return I18n.t((typeMeta[t] || typeMeta.system).key); }

  function render(view) {
    const notifications = Data.getNotifications();
    const unread = notifications.filter(n => !n.isRead).length;

    view.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <div style="font-size:16px; font-weight:700;">${I18n.t('通知中心')}</div>
          ${unread ? `<span class="chip chip-brand">${I18n.t('{n} 条未读', { n: unread })}</span>` : `<span class="chip chip-down">${I18n.t('已全部读取')}</span>`}
        </div>
        <div class="toolbar-right">
          <button class="btn btn-ghost btn-sm" onclick="window.__markAllRead()">${I18n.t('全部已读')}</button>
          <button class="btn btn-ghost btn-sm" onclick="window.__clearNotifications()" style="color:var(--up)">${I18n.t('清空')}</button>
        </div>
      </div>

      <div class="card">
        ${notifications.length ? `
          <div id="notif-list">
            ${notifications.map(n => {
              const meta = typeMeta[n.type] || typeMeta.system;
              return `
                <div class="notif-item ${n.isRead ? '' : 'unread'}" onclick="window.__readNotif('${n.id}')">
                  <div class="notif-icon ${meta.cls}">${Util.icon(meta.icon)}</div>
                  <div class="notif-body">
                    <div class="notif-title">${Util.escapeHtml(n.title)}</div>
                    <div class="notif-msg">${Util.escapeHtml(n.message)}</div>
                    <div class="notif-time">${Util.fmtRelativeTime(n.time)} · ${typeLabel(n.type)}</div>
                  </div>
                  ${n.isRead ? '' : '<div style="width:8px;height:8px;border-radius:50%;background:var(--brand);flex-shrink:0;"></div>'}
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="empty">
            <div class="empty-icon">${Util.icon('bell')}</div>
            <div class="empty-title">${I18n.t('暂无通知')}</div>
            <div class="empty-desc">${I18n.t('预算预警、大额交易、还款提醒都会出现在这里')}</div>
          </div>
        `}
      </div>
    `;
  }

  window.__readNotif = (id) => {
    Data.markNotificationRead(id);
    render(document.getElementById('view'));
    updateBadge();
  };

  window.__markAllRead = () => {
    Data.markAllNotificationsRead();
    Util.toast(I18n.t('已全部标记为已读'), 'success');
    render(document.getElementById('view'));
    updateBadge();
  };

  window.__clearNotifications = async () => {
    const ok = await Util.confirm(I18n.t('清空通知'), I18n.t('确定要清空所有通知吗?此操作不可恢复。'));
    if (ok) { Data.clearAllNotifications(); Util.toast(I18n.t('已清空'), 'success'); render(document.getElementById('view')); updateBadge(); }
  };

  function updateBadge() {
    const count = Data.unreadNotificationCount();
    const badge = document.getElementById('notif-badge');
    const bellBadge = document.getElementById('notif-bell-badge');
    if (badge) {
      if (count) { badge.textContent = count; badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    }
    if (bellBadge) {
      if (count) { bellBadge.textContent = count; bellBadge.classList.remove('hidden'); }
      else bellBadge.classList.add('hidden');
    }
  }

  return { render, updateBadge };
})();
