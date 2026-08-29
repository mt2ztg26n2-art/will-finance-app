const Sync = (() => {
  let sb = null;
  let user = null;
  let statusCb = () => {};
  const listeners = new Set();

  function init(client, currentUser) {
    sb = client; user = currentUser;
    window.addEventListener('online',  () => { statusCb('online');  replay(); });
    window.addEventListener('offline', () => { statusCb('offline'); });

    if (navigator.onLine) replay();
  }

  function setStatusCallback(cb) { statusCb = cb; }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function notify(event, payload) { listeners.forEach(fn => fn(event, payload)); }

  async function replay() {
    if (!sb || !user || !navigator.onLine) return;
    const pending = window.WF_Storage.readPending();
    if (!pending.length) return;

    notify('syncStart', { count: pending.length });
    const remaining = [];
    let ok = 0, fail = 0;
    for (const op of pending) {
      try {
        if (op.op === 'insert') {
          const { data, error } = await sb.from(op.table).insert(op.row).select().single();
          if (error) throw error;
          const local = window.WF_Storage.getLocalCollection(op.table);
          const idx = local.findIndex(r => r.id === op.row.id || r._pending);
          if (idx >= 0) {
            local[idx] = data;
            window.WF_Storage.setLocalCollection(op.table, local);
          }
          ok++;
        } else if (op.op === 'update') {
          if (String(op.id).startsWith('tmp_')) {
            const { row } = pending.find(p => p.id === op.id) || {};
            if (row) {
              const { data, error } = await sb.from(op.table).insert({ ...row, ...op.patch, user_id: user.id }).select().single();
              if (error) throw error;
            }
          } else {
            const { error } = await sb.from(op.table).update(op.patch).eq('id', op.id).eq('user_id', user.id);
            if (error) throw error;
          }
          ok++;
        } else if (op.op === 'delete') {
          if (!String(op.id).startsWith('tmp_')) {
            const { error } = await sb.from(op.table).delete().eq('id', op.id).eq('user_id', user.id);
            if (error) throw error;
          }
          ok++;
        }
      } catch (e) {
        console.warn('[Sync] replay failed:', e.message);
        fail++;
        if (!String(op.id || '').startsWith('tmp_')) remaining.push(op);
      }
    }
    window.WF_Storage.writePending(remaining);
    notify('syncEnd', { ok, fail, remaining: remaining.length });

    if (ok > 0) notify('refresh');
  }

  return { init, replay, setStatusCallback, subscribe };
})();

window.WF_Sync = Sync;
