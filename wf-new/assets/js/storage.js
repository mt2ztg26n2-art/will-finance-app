const Storage = (() => {
  const KEY_CACHE = 'wf_cache_v1';
  const KEY_PENDING = 'wf_pending_v1';

  let sb = null;
  let user = null;

  function init(client, currentUser) {
    sb = client;
    user = currentUser;
  }

  function setUser(u) { user = u; }

  function readCache() {
    try { return JSON.parse(localStorage.getItem(KEY_CACHE) || '{}'); } catch { return {}; }
  }
  function writeCache(obj) {
    localStorage.setItem(KEY_CACHE, JSON.stringify(obj));
  }
  function getLocalCollection(table) {
    return readCache()[table] || [];
  }
  function setLocalCollection(table, rows) {
    const c = readCache(); c[table] = rows; writeCache(c);
  }

  function readPending() {
    try { return JSON.parse(localStorage.getItem(KEY_PENDING) || '[]'); } catch { return []; }
  }
  function writePending(arr) { localStorage.setItem(KEY_PENDING, JSON.stringify(arr)); }
  function addPending(op) {
    const arr = readPending();
    arr.push({ ...op, ts: Date.now(), id: 'pending_' + Math.random().toString(36).slice(2) });
    writePending(arr);
  }

  async function fetchAll(table) {
    if (!sb || !user) return { data: getLocalCollection(table), fromCloud: false, offline: true };
    const { data, error } = await sb.from(table).select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) {
      console.warn('[Storage] cloud fetch failed:', error.message);
      return { data: getLocalCollection(table), fromCloud: false, offline: true, error };
    }
    if (data) setLocalCollection(table, data);
    return { data: data || [], fromCloud: true };
  }

  async function insert(table, row) {
    const payload = { ...row, user_id: user?.id, created_at: new Date().toISOString() };
    if (sb && user && navigator.onLine) {
      const { data, error } = await sb.from(table).insert(payload).select().single();
      if (error) { addPending({ op: 'insert', table, row: payload }); throw error; }
      const local = getLocalCollection(table); local.unshift(data);
      setLocalCollection(table, local);
      return data;
    } else {
      const tempRow = { ...payload, id: 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), _pending: true };
      const local = getLocalCollection(table); local.unshift(tempRow);
      setLocalCollection(table, local);
      addPending({ op: 'insert', table, row: payload });
      return tempRow;
    }
  }

  async function update(table, id, patch) {
    const local = getLocalCollection(table).map(r => r.id === id ? { ...r, ...patch } : r);
    setLocalCollection(table, local);

    if (sb && user && navigator.onLine && !String(id).startsWith('tmp_') && !String(id).startsWith('pending_')) {
      const { error } = await sb.from(table).update(patch).eq('id', id).eq('user_id', user.id);
      if (error) { addPending({ op: 'update', table, id, patch }); throw error; }
    } else {
      addPending({ op: 'update', table, id, patch });
    }
  }

  async function remove(table, id) {
    const local = getLocalCollection(table).filter(r => r.id !== id);
    setLocalCollection(table, local);

    if (sb && user && navigator.onLine && !String(id).startsWith('tmp_') && !String(id).startsWith('pending_')) {
      const { error } = await sb.from(table).delete().eq('id', id).eq('user_id', user.id);
      if (error) { addPending({ op: 'delete', table, id }); throw error; }
    } else {
      addPending({ op: 'delete', table, id });
    }
  }

  function wipeLocalCache() {
    localStorage.removeItem(KEY_CACHE);
    localStorage.removeItem(KEY_PENDING);
  }

  return {
    init, setUser,
    fetchAll, insert, update, remove,
    readPending, writePending, addPending,
    getLocalCollection, setLocalCollection,
    wipeLocalCache
  };
})();

window.WF_Storage = Storage;
