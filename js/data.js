/* =========================================================
   Data Layer
   - LocalStorage persistence per user
   - Schema: users / accounts / categories / transactions / budgets / notifications
   - 新增: pots (存钱罐) / rules (自动攒钱/扣款) / runRules 引擎
   ========================================================= */

const DB_KEY = (uid) => `cfo:${uid}:data`;
const SESSION_KEY = 'cfo:session';

const Data = (() => {
  // 单个用户的完整数据
  const emptyData = () => ({
    users: {},
    meta: { currentUser: null, createdAt: Date.now(), version: '1.0.0' },
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    notifications: [],
    education: [],
    liabilities: [],
    pots: [],   // 存钱罐：活期/定期/死期/小荷包
    rules: [],  // 自动攒钱/扣款规则（每日/每周/每月）
    logs: [],   // 痕迹日志：所有 CUD 操作的不可篡改流水（v40+）
    settings: {
      theme: 'light',
      monthlyBudget: 3000,
      monthlyBudgetByCategory: {},
      autoBackup: false,
      lastBackup: null,
      amapKey: '',  // 高德地图 JS API Key（v40+）
    },
  });

  let cache = emptyData();

  const _listeners = {};
  function on(evt, fn) {
    (_listeners[evt] = _listeners[evt] || []).push(fn);
    return () => off(evt, fn);
  }
  function off(evt, fn) {
    if (_listeners[evt]) _listeners[evt] = _listeners[evt].filter(f => f !== fn);
  }
  function emit(evt, payload) {
    (_listeners[evt] || []).forEach(fn => {
      try { fn(payload); } catch (e) { console.error('[Data event ' + evt + ']', e); }
    });
  }

  function load(uid) {
    const raw = localStorage.getItem(DB_KEY(uid));
    if (raw) {
      try {
        cache = JSON.parse(raw);
        // 兼容旧/部分数据: 缺失字段补默认, 防止 .length 读 undefined
        cache.users = cache.users || {};
        cache.meta = cache.meta || { currentUser: uid };
        cache.accounts = cache.accounts || [];
        cache.categories = cache.categories || [];
        cache.transactions = cache.transactions || [];
        cache.budgets = cache.budgets || [];
        cache.notifications = cache.notifications || [];
        cache.education = cache.education || [];
        cache.liabilities = cache.liabilities || [];
        cache.pots = cache.pots || [];
        cache.rules = cache.rules || [];
        cache.logs = cache.logs || [];
        cache.settings = cache.settings || {};
        return cache;
      } catch (e) {
        console.error('数据加载失败', e);
      }
    }
    cache = emptyData();
    cache.meta.currentUser = uid;
    return cache;
  }

  function save() {
    if (!cache.meta.currentUser) return;
    localStorage.setItem(DB_KEY(cache.meta.currentUser), JSON.stringify(cache));
    emit('change');
  }

  function clear() {
    if (cache.meta.currentUser) {
      localStorage.removeItem(DB_KEY(cache.meta.currentUser));
    }
    cache = emptyData();
  }

  // 一键清空：删除当前用户全部业务数据（账户/交易/存钱罐/规则/负债/教育/预算/通知/分类），
  // 但保留 users 映射与当前账户信息，方便用户录入自己的数据。
  function clearDemoData() {
    const user = cache.meta.currentUser;
    const users = cache.users;
    cache = emptyData();
    cache.meta.currentUser = user;
    cache.users = users || {};
    save();
  }

  // ============ 痕迹日志 (audit log) v40+ ============
  // 所有关键 CUD 操作都会调用 log() 留痕,渲染到「痕迹日志」页。
  function log({ type, action, target, targetId, summary, meta }) {
    try {
      const entry = {
        id: Util.uid(),
        time: Date.now(),
        type: type || 'system',         // system | tx | budget | account | pot | liability | education | rule | settings
        action: action || 'unknown',    // create | update | delete | login | sync | ...
        target: target || '',           // 人类可读的目标名
        targetId: targetId || null,
        summary: summary || '',
        meta: meta || null,
      };
      cache.logs = cache.logs || [];
      cache.logs.push(entry);
      // 限制最大 5000 条,避免无限增长
      if (cache.logs.length > 5000) cache.logs = cache.logs.slice(-5000);
      // 写入日志后不直接 save() (避免循环),由调用方 save
      return entry;
    } catch (e) { console.error('Data.log failed', e); return null; }
  }
  function getLogs({ type, since, until, limit } = {}) {
    let arr = (cache.logs || []).slice();
    if (type) arr = arr.filter(e => e.type === type);
    if (since) arr = arr.filter(e => e.time >= since);
    if (until) arr = arr.filter(e => e.time <= until);
    arr.sort((a, b) => b.time - a.time);
    if (limit) arr = arr.slice(0, limit);
    return arr;
  }
  function clearLogs() {
    cache.logs = [];
    save();
  }

  // ============ 跨模块聚合 (datacenter 枢纽用) v40+ ============
  function aggregate({ from, to, groupBy } = {}) {
    // 默认聚合最近 30 天
    const now = Date.now();
    const _from = from || (now - 30 * 86400000);
    const _to = to || now;
    const txs = cache.transactions.filter(t => t.time >= _from && t.time <= _to);
    let income = 0, expense = 0;
    txs.forEach(t => {
      const a = Number(t.amount || 0);
      if (t.type === 'income') income += a;
      else if (t.type === 'expense') expense += a;
    });
    const net = income - expense;
    const savingsRate = income > 0 ? Math.max(0, Math.min(1, net / income)) : 0;
    // 按 groupBy('day'|'week'|'month') 输出序列
    const series = {};
    const bucketKey = (t) => {
      const d = new Date(t.time);
      if (groupBy === 'month') return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (groupBy === 'week') {
        const onejan = new Date(d.getFullYear(), 0, 1);
        return d.getFullYear() + '-W' + Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
      }
      // default day
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };
    txs.forEach(t => {
      const k = bucketKey(t);
      series[k] = series[k] || { income: 0, expense: 0, net: 0, count: 0 };
      series[k].count++;
      if (t.type === 'income') series[k].income += Number(t.amount || 0);
      else if (t.type === 'expense') series[k].expense += Number(t.amount || 0);
      series[k].net = series[k].income - series[k].expense;
    });
    return {
      from: _from, to: _to,
      income: roundMoney(income),
      expense: roundMoney(expense),
      net: roundMoney(net),
      savingsRate,
      txCount: txs.length,
      series,
    };
  }

  // ============ 单笔交易后账户余额 (电子储蓄单用) v40+ ============
  function getBalanceAfterTx(tx) {
    if (!tx) return null;
    // 简化:返回该账户当前余额(对于历史回单可加时序回放,这里先返回当前值并标注)
    const acc = getAccount(tx.accountId);
    if (!acc) return 0;
    return roundMoney(Number(acc.balance || 0));
  }
  function getBalanceAtTime(accountId, atTime) {
    // 倒推指定时间点账户余额(忽略 pot 内部变动/规则注入,仅看显式交易)
    const acc = getAccount(accountId);
    if (!acc) return 0;
    let bal = Number(acc.balance || 0);
    const txs = cache.transactions.filter(t => t.accountId === accountId || t.toAccountId === accountId);
    txs.forEach(t => {
      if (t.time > atTime) {
        // 撤销这笔交易的影响
        if (t.accountId === accountId) {
          if (t.type === 'income') bal -= Number(t.amount || 0);
          else if (t.type === 'expense') bal += Number(t.amount || 0);
          else if (t.type === 'transfer') bal += Number(t.amount || 0);
        }
        if (t.toAccountId === accountId) {
          if (t.type === 'transfer') bal -= Number(t.amount || 0);
        }
      }
    });
    return roundMoney(bal);
  }

  function getAccounts() { return cache.accounts.slice(); }
  function getAccount(id) { return cache.accounts.find(a => a.id === id); }
  function addAccount(acc) {
    acc.id = acc.id || Util.uid();
    acc.createdAt = acc.createdAt || Date.now();
    acc.balance = Number(acc.balance || 0);
    cache.accounts.push(acc);
    log({ type: 'account', action: 'create', target: acc.name, targetId: acc.id, summary: `新增账户「${acc.name}」,余额 ¥${acc.balance}`, meta: { balance: acc.balance, type: acc.type } });
    save();
    return acc;
  }
  function updateAccount(id, patch) {
    const a = getAccount(id);
    if (!a) return null;
    const before = { balance: a.balance, name: a.name };
    Object.assign(a, patch);
    log({ type: 'account', action: 'update', target: a.name, targetId: id, summary: `账户「${a.name}」已更新`, meta: { before, patch } });
    save();
    return a;
  }
  function deleteAccount(id) {
    const a = getAccount(id);
    cache.accounts = cache.accounts.filter(x => x.id !== id);
    cache.transactions = cache.transactions.filter(t => t.accountId !== id && t.toAccountId !== id);
    if (a) log({ type: 'account', action: 'delete', target: a.name, targetId: id, summary: `删除账户「${a.name}」及关联交易`, meta: { balance: a.balance } });
    save();
  }

  function getCategories(type) {
    return type ? cache.categories.filter(c => c.type === type || c.type === 'all') : cache.categories.slice();
  }
  function addCategory(cat) {
    cat.id = cat.id || Util.uid();
    cache.categories.push(cat);
    save();
    return cat;
  }
  function deleteCategory(id) {
    cache.categories = cache.categories.filter(c => c.id !== id);
    save();
  }

  // ===== 三级分类(大类 → 子类 → 小类)助手 =====
  function getCategoryById(id) {
    return (cache.categories || []).find(c => c.id === id) || null;
  }
  // 返回带 children 的层级树(根节点 parent=null)
  function getCategoryTree() {
    const cats = cache.categories || [];
    const byId = {};
    cats.forEach(c => { byId[c.id] = Object.assign({}, c, { children: [] }); });
    const roots = [];
    cats.forEach(c => {
      if (c.parent && byId[c.parent]) byId[c.parent].children.push(byId[c.id]);
      else roots.push(byId[c.id]);
    });
    return roots;
  }
  // 返回从根到该节点(含)的路径数组
  function getCategoryPath(id) {
    const byId = {};
    (cache.categories || []).forEach(c => { byId[c.id] = c; });
    const path = [];
    let cur = byId[id];
    while (cur) { path.unshift(cur); cur = cur.parent ? byId[cur.parent] : null; }
    return path;
  }
  // 返回所有叶子(无子节点)分类,可限定 type
  function getLeafCategories(type) {
    const tree = getCategoryTree();
    const out = [];
    (function walk(nodes) {
      nodes.forEach(n => {
        if (n.children && n.children.length) walk(n.children);
        else if (!type || n.type === type) out.push(n);
      });
    })(tree);
    return out;
  }
  function getCategoryBreadcrumb(id, sep) {
    const path = getCategoryPath(id);
    return path.map(c => c.name).join(sep || ' / ');
  }

  function getTransactions() { return cache.transactions.slice().sort((a, b) => b.time - a.time); }
  function addTransaction(tx) {
    tx.id = tx.id || Util.uid();
    tx.time = tx.time || Date.now();
    cache.transactions.push(tx);
    applyTransactionToAccounts(tx);
    const cat = tx.categoryId ? getCategoryById(tx.categoryId) : null;
    const catName = cat ? getCategoryBreadcrumb(cat.id, '/') : (tx.type === 'transfer' ? '转账' : '未分类');
    const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '';
    log({ type: 'tx', action: 'create', target: catName, targetId: tx.id, summary: `记一笔 ${sign}¥${tx.amount} · ${catName}`, meta: { type: tx.type, amount: tx.amount, accountId: tx.accountId } });
    save();
    maybeGenerateNotifications(tx);
    return tx;
  }
  function updateTransaction(id, patch) {
    const tx = cache.transactions.find(t => t.id === id);
    if (!tx) return null;
    reverseTransactionFromAccounts(tx);
    Object.assign(tx, patch);
    tx.time = patch.time || tx.time;
    applyTransactionToAccounts(tx);
    log({ type: 'tx', action: 'update', target: id, targetId: id, summary: `更新交易 ¥${tx.amount}`, meta: { patch } });
    save();
    return tx;
  }
  function deleteTransaction(id) {
    const tx = cache.transactions.find(t => t.id === id);
    if (!tx) return;
    reverseTransactionFromAccounts(tx);
    cache.transactions = cache.transactions.filter(t => t.id !== id);
    log({ type: 'tx', action: 'delete', target: id, targetId: id, summary: `删除交易 ¥${tx.amount}`, meta: { type: tx.type, amount: tx.amount } });
    save();
  }

  function applyTransactionToAccounts(tx) {
    if (tx.type === 'income') {
      const acc = getAccount(tx.accountId);
      if (acc) acc.balance = roundMoney(acc.balance + Number(tx.amount));
    } else if (tx.type === 'expense') {
      const acc = getAccount(tx.accountId);
      if (acc) acc.balance = roundMoney(acc.balance - Number(tx.amount));
    } else if (tx.type === 'transfer') {
      const a = getAccount(tx.accountId);
      const b = tx.toAccountId ? getAccount(tx.toAccountId) : null;
      if (a) a.balance = roundMoney(a.balance - Number(tx.amount));
      if (b) b.balance = roundMoney(b.balance + Number(tx.amount));
    }
  }
  function reverseTransactionFromAccounts(tx) {
    if (tx.type === 'income') {
      const acc = getAccount(tx.accountId);
      if (acc) acc.balance = roundMoney(acc.balance - Number(tx.amount));
    } else if (tx.type === 'expense') {
      const acc = getAccount(tx.accountId);
      if (acc) acc.balance = roundMoney(acc.balance + Number(tx.amount));
    } else if (tx.type === 'transfer') {
      const a = getAccount(tx.accountId);
      const b = tx.toAccountId ? getAccount(tx.toAccountId) : null;
      if (a) a.balance = roundMoney(a.balance + Number(tx.amount));
      if (b) b.balance = roundMoney(b.balance - Number(tx.amount));
    }
  }
  function roundMoney(n) { return Math.round(n * 100) / 100; }

  function totals() {
    const assetAccounts = cache.accounts.filter(a => a.type !== 'liability' && !a.archived);
    const liabilityAccounts = cache.accounts.filter(a => a.type === 'liability' && !a.archived);
    const totalAssets = assetAccounts.reduce((s, a) => s + Number(a.balance || 0), 0);
    const liabAccountSum = liabilityAccounts.reduce((s, a) => s + Math.abs(Number(a.balance || 0)), 0);
    const liabRecordSum = cache.liabilities.reduce((s, l) => s + Math.abs(Number(l.remaining || 0)), 0);
    const totalLiabilities = liabAccountSum + liabRecordSum;
    const totalSaved = (cache.pots || []).reduce((s, p) => s + Number(p.balance || 0), 0);
    return {
      totalAssets: roundMoney(totalAssets + totalSaved),
      totalLiabilities: roundMoney(totalLiabilities),
      netAssets: roundMoney(totalAssets + totalSaved - totalLiabilities),
      totalSaved: roundMoney(totalSaved),
    };
  }

  function getEducationStages() { return cache.education.slice(); }
  function addEducationStage(stage) {
    stage.id = stage.id || Util.uid();
    cache.education.push(stage);
    log({ type: 'education', action: 'create', target: stage.stage, targetId: stage.id, summary: `新增教育阶段「${stage.stage}」`, meta: { location: stage.location, total: stage.total } });
    save();
    return stage;
  }
  function updateEducationStage(id, patch) {
    const s = cache.education.find(e => e.id === id);
    if (!s) return null;
    Object.assign(s, patch);
    log({ type: 'education', action: 'update', target: s.stage, targetId: id, summary: `更新教育阶段「${s.stage}」`, meta: { patch } });
    save();
    return s;
  }
  function deleteEducationStage(id) {
    const s = cache.education.find(e => e.id === id);
    cache.education = cache.education.filter(e => e.id !== id);
    if (s) log({ type: 'education', action: 'delete', target: s.stage, targetId: id, summary: `删除教育阶段「${s.stage}」` });
    save();
  }

  function getLiabilities() { return cache.liabilities.slice(); }
  function addLiability(l) {
    l.id = l.id || Util.uid();
    l.createdAt = l.createdAt || Date.now();
    cache.liabilities.push(l);
    log({ type: 'liability', action: 'create', target: l.name, targetId: l.id, summary: `新增负债「${l.name}」¥${l.total}`, meta: { total: l.total, remaining: l.remaining } });
    save();
    return l;
  }
  function updateLiability(id, patch) {
    const l = cache.liabilities.find(x => x.id === id);
    if (!l) return null;
    Object.assign(l, patch);
    log({ type: 'liability', action: 'update', target: l.name, targetId: id, summary: `更新负债「${l.name}」`, meta: { patch } });
    save();
    return l;
  }
  function deleteLiability(id) {
    const l = cache.liabilities.find(x => x.id === id);
    cache.liabilities = cache.liabilities.filter(x => x.id !== id);
    if (l) log({ type: 'liability', action: 'delete', target: l.name, targetId: id, summary: `删除负债「${l.name}」` });
    save();
  }

  function getBudgets() { return cache.budgets.slice(); }
  function getBudgetForMonth(ym, categoryId) {
    return cache.budgets.find(b => b.yearMonth === ym && (!categoryId || b.categoryId === categoryId));
  }
  function setBudget(budget) {
    budget.id = budget.id || Util.uid();
    const existing = cache.budgets.find(b => b.yearMonth === budget.yearMonth && b.categoryId === budget.categoryId);
    if (existing) {
      Object.assign(existing, budget);
      log({ type: 'budget', action: 'update', target: budget.categoryId || '总预算', targetId: existing.id, summary: `更新预算 ¥${budget.amount} (${budget.yearMonth})`, meta: { amount: budget.amount, categoryId: budget.categoryId } });
    } else {
      cache.budgets.push(budget);
      log({ type: 'budget', action: 'create', target: budget.categoryId || '总预算', targetId: budget.id, summary: `设置预算 ¥${budget.amount} (${budget.yearMonth})`, meta: { amount: budget.amount, categoryId: budget.categoryId } });
    }
    save();
    return budget;
  }
  function deleteBudget(id) {
    const b = cache.budgets.find(x => x.id === id);
    cache.budgets = cache.budgets.filter(b => b.id !== id);
    if (b) log({ type: 'budget', action: 'delete', target: b.categoryId || '总预算', targetId: id, summary: `删除预算 ¥${b.amount} (${b.yearMonth})` });
    save();
  }

  function getNotifications() { return cache.notifications.slice().sort((a, b) => b.time - a.time); }
  function unreadNotificationCount() { return cache.notifications.filter(n => !n.isRead).length; }
  function addNotification(n) {
    n.id = n.id || Util.uid();
    n.time = n.time || Date.now();
    n.isRead = false;
    cache.notifications.push(n);
    save();
    return n;
  }
  function markNotificationRead(id) {
    const n = cache.notifications.find(x => x.id === id);
    if (n) { n.isRead = true; save(); }
  }
  function markAllNotificationsRead() {
    cache.notifications.forEach(n => n.isRead = true);
    save();
  }
  function clearAllNotifications() {
    cache.notifications = [];
    save();
  }

  function getSettings() { return cache.settings; }
  function updateSettings(patch) {
    Object.assign(cache.settings, patch);
    const keys = Object.keys(patch || {}).join(', ');
    log({ type: 'settings', action: 'update', target: '设置', targetId: null, summary: `更新设置 (${keys})`, meta: { patch } });
    save();
    return cache.settings;
  }

  function getCurrentUser() { return cache.meta.currentUser; }

  // ============ 存钱罐 (pots) ============
  function getPots() { return (cache.pots || []).slice(); }
  function getPot(id) { return (cache.pots || []).find(p => p.id === id); }
  function addPot(p) {
    p.id = p.id || Util.uid();
    p.createdAt = p.createdAt || Date.now();
    p.balance = Number(p.balance || 0);
    cache.pots = cache.pots || [];
    cache.pots.push(p);
    log({ type: 'pot', action: 'create', target: p.name, targetId: p.id, summary: `新增存钱罐「${p.name}」,余额 ¥${p.balance}`, meta: { type: p.type, target: p.target } });
    save();
    return p;
  }
  function updatePot(id, patch) {
    const p = getPot(id);
    if (!p) return null;
    Object.assign(p, patch);
    log({ type: 'pot', action: 'update', target: p.name, targetId: id, summary: `更新存钱罐「${p.name}」`, meta: { patch } });
    save();
    return p;
  }
  function deletePot(id) {
    const p = getPot(id);
    cache.pots = (cache.pots || []).filter(x => x.id !== id);
    cache.rules = (cache.rules || []).filter(r => r.toPotId !== id);
    if (p) log({ type: 'pot', action: 'delete', target: p.name, targetId: id, summary: `删除存钱罐「${p.name}」` });
    save();
  }

  // ============ 自动攒钱 / 扣款规则 (rules) ============
  function getRules() { return (cache.rules || []).slice(); }
  function getRule(id) { return (cache.rules || []).find(r => r.id === id); }
  function addRule(r) {
    r.id = r.id || Util.uid();
    r.createdAt = r.createdAt || Date.now();
    r.active = r.active !== false;
    r.lastRun = r.lastRun || null;
    cache.rules = cache.rules || [];
    cache.rules.push(r);
    log({ type: 'rule', action: 'create', target: r.name, targetId: r.id, summary: `新增自动规则「${r.name}」`, meta: { amount: r.amount, freq: r.freq } });
    save();
    return r;
  }
  function updateRule(id, patch) {
    const r = getRule(id);
    if (!r) return null;
    Object.assign(r, patch);
    log({ type: 'rule', action: 'update', target: r.name, targetId: id, summary: `更新自动规则「${r.name}」`, meta: { patch } });
    save();
    return r;
  }
  function deleteRule(id) {
    const r = getRule(id);
    cache.rules = (cache.rules || []).filter(x => x.id !== id);
    if (r) log({ type: 'rule', action: 'delete', target: r.name, targetId: id, summary: `删除自动规则「${r.name}」` });
    save();
  }

  function nextRunFor(r, base) {
    const d = new Date(base);
    if (r.freq === 'daily') {
      d.setDate(d.getDate() + 1);
      return d.getTime();
    }
    if (r.freq === 'weekly') {
      const target = (typeof r.dayOfWeek === 'number') ? r.dayOfWeek : d.getDay();
      do { d.setDate(d.getDate() + 1); } while (d.getDay() !== target);
      return d.getTime();
    }
    if (r.freq === 'monthly') {
      const day = (typeof r.dayOfMonth === 'number') ? r.dayOfMonth : d.getDate();
      d.setMonth(d.getMonth() + 1, 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last));
      return d.getTime();
    }
    return base + 86400000;
  }

  function applyRule(r, runTime) {
    const acc = getAccount(r.fromAccountId);
    if (!acc) return;
    const autoCat = cache.categories.find(c => c.name === '自动攒钱');
    const catId = autoCat ? autoCat.id : null;
    const tx = { id: Util.uid(), time: runTime, categoryId: catId, description: '自动攒钱 · ' + r.name };
    if (r.toType === 'account' && r.toAccountId) {
      tx.type = 'transfer';
      tx.amount = r.amount;
      tx.accountId = r.fromAccountId;
      tx.toAccountId = r.toAccountId;
      tx.payee = r.name;
    } else {
      tx.type = 'expense';
      tx.amount = r.amount;
      tx.accountId = r.fromAccountId;
      tx.payee = (r.toType === 'pot' && getPot(r.toPotId)) ? getPot(r.toPotId).name : r.name;
      if (r.toType === 'pot' && r.toPotId) {
        const pot = getPot(r.toPotId);
        if (pot) pot.balance = roundMoney(pot.balance + Number(r.amount));
      }
    }
    cache.transactions.push(tx);
    applyTransactionToAccounts(tx);
  }

  // 处理到期规则：注入交易 + 推进下次执行时间。返回是否发生变化。
  function runRules(now = Date.now()) {
    const rules = cache.rules || [];
    if (!rules.length) return false;
    const cap = 90 * 86400000;
    let changed = false;
    let count = 0;
    for (const r of rules) {
      if (!r.active || !r.nextRun) continue;
      let cursor = r.nextRun;
      // 久未打开应用：避免疯狂补录, 从昨天起算
      if (cursor < now - cap) cursor = now - 86400000;
      while (cursor <= now) {
        applyRule(r, cursor);
        r.lastRun = cursor;
        cursor = nextRunFor(r, cursor);
        count++;
        if (count > 400) break;
      }
      if (cursor !== r.nextRun) { r.nextRun = cursor; changed = true; }
    }
    if (changed) {
      save();
      addNotification({
        type: 'auto',
        title: '自动攒钱已执行',
        message: `本次共完成 ${count} 笔自动攒钱/扣款, 资金已同步至对应存钱罐与账户。`,
        time: now,
      });
    }
    return changed;
  }

  function exportAll() {
    return JSON.stringify({
      ...cache,
      exportedAt: Date.now(),
    }, null, 2);
  }
  function importAll(jsonStr) {
    const data = JSON.parse(jsonStr);
    cache = { ...emptyData(), ...data };
    cache.pots = cache.pots || [];
    cache.rules = cache.rules || [];
    cache.logs = cache.logs || [];
    save();
  }

  function seedDemoData() {
    const now = Date.now();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // 分类(三级:大类 → 子类 → 小类)。top 节点带 group 键,子节点继承其 group 与 type。
    const cats = [];
    const catIdByName = {};
    function seedCat(spec, parent, ctx) {
      const id = Util.uid();
      const node = {
        id,
        name: spec.name,
        icon: spec.icon || (ctx && ctx.icon),
        type: spec.type || (ctx && ctx.type),
        color: spec.color || (ctx && ctx.color),
        category: (ctx && ctx.group) || spec.group,
        parent: parent || null,
      };
      cats.push(node);
      catIdByName[spec.name] = id;
      if (spec.children) spec.children.forEach(ch => seedCat(ch, id, { icon: node.icon, type: node.type, color: node.color, group: node.category }));
      return id;
    }
    [
      // —— 收入 ——
      { name: '家庭', icon: 'user', type: 'income', color: '#0f5132', group: 'family', children: [
        { name: '父母生活费' }, { name: '长辈红包', color: '#2e9d63' },
      ]},
      { name: '创业', icon: 'briefcase', type: 'income', color: '#2e9d63', group: 'business', children: [
        { name: '创业收入' }, { name: '销售利润', color: '#00b96b' }, { name: '投资收益', color: '#13c2c2' },
      ]},
      { name: '学业', icon: 'graduation', type: 'income', color: '#00b96b', group: 'study', children: [
        { name: '奖学金' }, { name: '助学金', color: '#4cae7a' }, { name: '比赛奖金', color: '#13c2c2' },
      ]},
      { name: '兼职', icon: 'briefcase', type: 'income', color: '#13c2c2', group: 'parttime', children: [
        { name: '实习工资' }, { name: '稿费', color: '#1d7a4d' }, { name: '家教', color: '#36cfc9' },
      ]},
      // —— 支出 ——
      { name: '生活', icon: 'receipt', type: 'expense', color: '#ff7d00', group: 'life', children: [
        { name: '餐饮', color: '#ff7d00', children: [
          { name: '早午晚餐' }, { name: '零食饮料', color: '#eb2f96' }, { name: '外卖', color: '#ff9c3f' }, { name: '聚餐宴请', color: '#9254de' },
        ]},
        { name: '日用品', color: '#9254de', children: [
          { name: '洗护用品' }, { name: '家居杂货', color: '#722ed1' }, { name: '服饰鞋包', color: '#eb2f96' },
        ]},
        { name: '通讯', color: '#1d7a4d', children: [
          { name: '话费' }, { name: '网费', color: '#13c2c2' },
        ]},
        { name: '娱乐', color: '#eb2f96', children: [
          { name: '电影演出' }, { name: '游戏', color: '#722ed1' }, { name: '健身运动', color: '#00b96b' },
        ]},
      ]},
      { name: '交通', icon: 'transport', type: 'expense', color: '#ff4d4f', group: 'transport', children: [
        { name: '公共交通', color: '#ff4d4f', children: [
          { name: '地铁' }, { name: '公交', color: '#cf1322' },
        ]},
        { name: '打车', color: '#fa541c', children: [
          { name: '网约车' }, { name: '出租车', color: '#d4380d' },
        ]},
        { name: '私家车', color: '#ad4e00', children: [
          { name: '油费' }, { name: '停车费', color: '#873800' }, { name: '保养维修', color: '#ad2102' },
        ]},
        { name: '出行', color: '#a8071a', children: [
          { name: '火车票' }, { name: '机票', color: '#820014' },
        ]},
      ]},
      { name: '医疗', icon: 'medical', type: 'expense', color: '#f5222d', group: 'medical', children: [
        { name: '门诊', color: '#f5222d', children: [
          { name: '挂号诊疗' }, { name: '检查化验', color: '#cf1322' },
        ]},
        { name: '药品', color: '#fa541c', children: [
          { name: '西药' }, { name: '中药', color: '#d4380d' },
        ]},
        { name: '保健', color: '#ad6800', children: [
          { name: '体检' }, { name: '保险', color: '#874d00' },
        ]},
      ]},
      { name: '教育', icon: 'graduation', type: 'expense', color: '#00b96b', group: 'education', children: [
        { name: '学费', color: '#00b96b', children: [
          { name: '课程费' }, { name: '学杂费', color: '#08979c' },
        ]},
        { name: '书本', color: '#0a3320', children: [
          { name: '教材' }, { name: '参考书', color: '#135200' },
        ]},
        { name: '培训', color: '#13c2c2', children: [
          { name: '考证' }, { name: '技能班', color: '#08979c' },
        ]},
        { name: '留学', color: '#4cae7a', children: [
          { name: '申请费' }, { name: '语言考试', color: '#237804' },
        ]},
        { name: '生活费', color: '#ff7d00', children: [
          { name: '住宿' }, { name: '餐饮', color: '#fa8c16' }, { name: '日用', color: '#d46b08' },
        ]},
        { name: '杂费', color: '#9254de', children: [
          { name: '其他' },
        ]},
      ]},
      { name: '创业', icon: 'briefcase', type: 'expense', color: '#ff7d00', group: 'business', children: [
        { name: '设备', color: '#36cfc9', children: [
          { name: '硬件' }, { name: '软件', color: '#08979c' },
        ]},
        { name: '差旅', color: '#ff7d00', children: [
          { name: '住宿' }, { name: '差旅交通', color: '#d46b08' },
        ]},
        { name: '外包', color: '#9254de', children: [
          { name: '设计外包' }, { name: '开发外包', color: '#722ed1' },
        ]},
        { name: '营销', color: '#eb2f96', children: [
          { name: '广告投放' }, { name: '推广', color: '#c41d7f' },
        ]},
      ]},
      { name: '负债', icon: 'shield-alert', type: 'expense', color: '#ff4d4f', group: 'liability', children: [
        { name: '花呗' }, { name: '信用卡', color: '#0c3d27' },
      ]},
      { name: '储蓄', icon: 'refresh-cw', type: 'expense', color: '#ff7d00', group: 'saving', children: [
        { name: '自动攒钱' },
      ]},
    ].forEach(s => seedCat(s, null, null));
    cache.categories = cats;

    // 账户
    const accounts = [
      { id: Util.uid(), name: '招商银行卡', type: 'bank', icon: 'landmark', color: '#0c3d27', balance: 8200, number: '**** 6823', createdAt: now },
      { id: Util.uid(), name: '建设银行卡', type: 'bank', icon: 'landmark', color: '#082619', balance: 4200, number: '**** 3091', createdAt: now },
      { id: Util.uid(), name: '支付宝', type: 'alipay', icon: 'wallet', color: '#0f5132', balance: 1860, number: '138****8888', createdAt: now },
      { id: Util.uid(), name: '微信钱包', type: 'wechat', icon: 'smartphone', color: '#13c2c2', balance: 920, number: 'wxid_***', createdAt: now },
      { id: Util.uid(), name: '现金', type: 'cash', icon: 'banknote', color: '#2e9d63', balance: 280, createdAt: now },
      { id: Util.uid(), name: '创业储备金', type: 'business', icon: 'briefcase', color: '#ff7d00', balance: 12450, createdAt: now },
    ];
    cache.accounts = accounts;

    // 存钱罐 (活期 / 定期 / 死期 / 小荷包)
    const xiaohebao = { id: Util.uid(), name: '支付宝小荷包', type: 'xiaohebao', color: '#ff7d00', icon: 'wallet', balance: 320, target: 3650, note: '每天攒 10 元,一年 3650', createdAt: now };
    const lingqian = { id: Util.uid(), name: '零钱罐', type: 'huoqi', color: '#13c2c2', icon: 'banknote', balance: 680, target: 2000, note: '活期,随时存取', createdAt: now };
    const dingqi = { id: Util.uid(), name: '定期存款 A', type: 'dingqi', color: '#0f5132', icon: 'landmark', balance: 5000, rate: 1.8, termMonths: 12, startAt: now, matureAt: new Date(now).setMonth(new Date(now).getMonth() + 12), note: '整存整取 1 年', createdAt: now };
    const siqi = { id: Util.uid(), name: '整存整取 B', type: 'siqi', color: '#9254de', icon: 'lock', balance: 8000, rate: 2.25, termMonths: 24, startAt: now, matureAt: new Date(now).setMonth(new Date(now).getMonth() + 24), locked: true, note: '2 年期,到期支取', createdAt: now };
    cache.pots = [xiaohebao, lingqian, dingqi, siqi];

    // 自动攒钱规则：每天从招商银行卡扣 10 元 -> 支付宝小荷包
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    cache.rules = [
      {
        id: Util.uid(), name: '每天向小荷包存 10 元',
        fromAccountId: accounts[0].id, toType: 'pot', toPotId: xiaohebao.id,
        amount: 10, freq: 'daily', nextRun: today0.getTime(), lastRun: null, active: true, createdAt: now,
      },
    ];

    // 负债
    cache.liabilities = [
      {
        id: Util.uid(), name: '花呗', type: 'huabei', total: 1500, paid: 800, remaining: 700,
        monthlyPayment: 200, dueDate: 9, nextDueDate: thisMonth.getTime(), remind: true, note: '主要用于数码和差旅', createdAt: now,
      },
      {
        id: Util.uid(), name: '招商银行信用卡', type: 'creditcard', total: 5000, paid: 4500, remaining: 500,
        monthlyPayment: 500, dueDate: 25, nextDueDate: thisMonth.getTime(), remind: true, note: '日常消费', createdAt: now,
      },
    ];

    // 教育阶段
    cache.education = [
      {
        id: Util.uid(), stage: '本科 · 中国传媒大学', location: '北京', startDate: '2022-09', endDate: '2026-07',
        tuition: 28000, living: 36000, books: 8500, supplies: 4200, total: 76700, current: true,
      },
      {
        id: Util.uid(), stage: '新加坡国立大学 · 交换', location: '新加坡', startDate: '2025-02', endDate: '2025-07',
        tuition: 48000, living: 32000, books: 2400, supplies: 1800, total: 84200, current: false,
      },
    ];

    // 交易数据 (近 90 天)
    const txs = [];
    function rand(min, max) { return Math.random() * (max - min) + min; }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // 演示用: 在多个省/市/区之间分布交易地点, 让「区域消费热力图」有数据可看
    const LOC_POOL = [
      '北京市/北京市/朝阳区', '上海市/上海市/浦东新区', '广东省/广州市/天河区', '广东省/深圳市/南山区',
      '浙江省/杭州市/西湖区', '江苏省/南京市/鼓楼区', '四川省/成都市/武侯区', '湖北省/武汉市/洪山区',
      '陕西省/西安市/雁塔区', '重庆市/重庆市/渝中区', '山东省/青岛市/市南区', '福建省/厦门市/思明区',
    ];
    const loc = () => pick(LOC_POOL);

    const C = (name) => catIdByName[name];  // 取叶子分类 id

    const incomeFamily = C('父母生活费');
    const incomeBiz = C('创业收入');
    const meal = C('早午晚餐');
    const transit = C('地铁');
    const book = C('教材');
    const bizLeaves = cats.filter(c => c.type === 'expense' && c.category === 'business').map(c => c.id);

    const businessAccounts = accounts.filter(a => a.type === 'business');
    const allAccounts = accounts.filter(a => a.type !== 'business');

    for (let i = 0; i < 90; i++) {
      const ts = thisMonth.getTime() - i * 24 * 60 * 60 * 1000;
      if (new Date(ts).getDate() === 1 || (i === 0 && new Date(ts).getDate() <= 3)) {
        txs.push({
          id: Util.uid(), type: 'income', amount: 2500, time: ts, accountId: accounts[0].id,
          categoryId: incomeFamily, payee: '父母', location: loc(), description: '月度生活费',
        });
      }
      if (Math.random() < 0.25) {
        const acc = pick([accounts[2], accounts[5], accounts[1]]);
        txs.push({
          id: Util.uid(), type: 'income', amount: rand(300, 1800), time: ts, accountId: acc.id,
          categoryId: incomeBiz, payee: pick(['客户李经理', '设计公司A', '科技工作室B', '创业客户']), location: loc(), description: '项目尾款',
        });
      }
      if (Math.random() < 0.85) {
        txs.push({
          id: Util.uid(), type: 'expense', amount: rand(15, 60), time: ts, accountId: pick([accounts[2], accounts[3], accounts[4]]).id,
          categoryId: meal, payee: pick(['食堂', '麦当劳', '麻辣烫', '兰州拉面', '校园咖啡']), location: loc(), description: '工作日餐',
        });
      }
      if (Math.random() < 0.6) {
        txs.push({
          id: Util.uid(), type: 'expense', amount: rand(3, 35), time: ts, accountId: pick([accounts[2], accounts[3], accounts[4]]).id,
          categoryId: transit, payee: pick(['地铁', '滴滴', '出租车']), location: loc(), description: '日常通勤',
        });
      }
      if (Math.random() < 0.15) {
        txs.push({
          id: Util.uid(), type: 'expense', amount: rand(40, 350), time: ts, accountId: pick([accounts[0], accounts[1]]).id,
          categoryId: book, payee: pick(['当当网', '卓越亚马逊', '京东图书', '打印店']), location: loc(), description: '教材资料',
        });
      }
      if (Math.random() < 0.1) {
        const bizAcc = pick(businessAccounts.length ? businessAccounts : [accounts[5]]);
        txs.push({
          id: Util.uid(), type: 'expense', amount: rand(80, 800), time: ts, accountId: bizAcc.id,
          categoryId: pick(bizLeaves), payee: pick(['京东数码', '滴滴企业版', '打印店', '外包设计师']), location: loc(), description: '项目支出',
        });
      }
      if (Math.random() < 0.03) {
        txs.push({
          id: Util.uid(), type: 'transfer', amount: rand(200, 1000), time: ts, accountId: accounts[0].id, toAccountId: accounts[5].id,
          payee: '转入创业储备金', description: '月度创业资金储备',
        });
      }
    }

    cache.transactions = txs;
    cache.accounts.forEach(a => a.balance = 0);
    cache.accounts.forEach((_, idx) => {
      const init = [8200, 4200, 1860, 920, 280, 12450][idx] || 0;
      const a = cache.accounts[idx];
      if (a) a.balance = init;
    });
    cache.transactions.forEach(t => applyTransactionToAccounts(t));

    // 预算
    cache.budgets = [
      { id: Util.uid(), yearMonth: Util.todayMonth(), categoryId: null, amount: 3000, note: '月度总预算' },
    ];

    // 通知
    cache.notifications = [
      {
        id: Util.uid(), type: 'system', title: '欢迎使用个人金融系统',
        message: '已为您预置示例数据,含存钱罐与「每天向小荷包存 10 元」自动攒钱计划。所有数据仅存储在本地浏览器。',
        time: now, isRead: false,
      },
      {
        id: Util.uid(), type: 'budget', title: '月度预算已设定',
        message: `${Util.monthLabel(Util.todayMonth())}预算 ¥3,000.00,建议餐饮≤¥1,200,学习≤¥500。`,
        time: now - 86400_000, isRead: false,
      },
    ];

    save();
  }

  function maybeGenerateNotifications(tx) {
    if (Math.abs(Number(tx.amount)) >= 1000) {
      addNotification({
        type: 'large', title: tx.type === 'income' ? '大额收入' : '大额支出',
        message: `${Util.fmtDateTime(tx.time)} · ${tx.type === 'income' ? '收入' : '支出'} ${Util.fmtMoney(tx.amount)} · ${tx.payee || '未知'}`,
        time: tx.time,
      });
    }
    const ym = Util.fmtMonth(tx.time);
    const monthExpenses = cache.transactions
      .filter(t => t.type === 'expense' && Util.fmtMonth(t.time) === ym)
      .reduce((s, t) => s + Number(t.amount), 0);
    // 总预算超支(每月首次超支时通知一次,之后每次新增超支额 >= 10% 时再提醒)
    const totalBudget = cache.budgets.find(b => b.yearMonth === ym && !b.categoryId);
    if (totalBudget && monthExpenses > totalBudget.amount) {
      const over = monthExpenses - totalBudget.amount;
      const ratio = monthExpenses / totalBudget.amount;
      const firstOver = cache.notifications.find(n => n.type === 'budget' && Util.fmtMonth(n.time) === ym && n.meta && n.meta.kind === 'total');
      if (!firstOver) {
        addNotification({
          type: 'budget', title: '月度预算已超支', level: 'warn',
          message: `${Util.monthLabel(ym)}支出已达 ${Util.fmtMoney(monthExpenses)}, 超出总预算 ${Util.fmtMoney(over)} (${(ratio*100).toFixed(0)}%)。`,
          time: Date.now(), meta: { kind: 'total', ym, amount: monthExpenses, over, ratio },
        });
      } else if (ratio - (firstOver.meta.ratio || 0) >= 0.1) {
        addNotification({
          type: 'budget', title: '预算超支加剧', level: 'warn',
          message: `${Util.monthLabel(ym)}总预算超支已达 ${(ratio*100).toFixed(0)}%, 累计超出 ${Util.fmtMoney(over)}。`,
          time: Date.now(), meta: { kind: 'total', ym, amount: monthExpenses, over, ratio },
        });
      }
    }
    // 分类预算超支:每分类每天最多一次提醒
    if (tx.type === 'expense' && tx.categoryId) {
      const catBudget = cache.budgets.find(b => b.yearMonth === ym && b.categoryId === tx.categoryId);
      if (catBudget) {
        const catSpent = cache.transactions
          .filter(t => t.type === 'expense' && t.categoryId === tx.categoryId && Util.fmtMonth(t.time) === ym)
          .reduce((s, t) => s + Number(t.amount), 0);
        if (catSpent > catBudget.amount) {
          const day = new Date(tx.time).toISOString().slice(0, 10);
          const catName = getCategoryBreadcrumb(tx.categoryId, '/');
          const dup = cache.notifications.find(n => n.type === 'budget' && n.meta && n.meta.kind === 'cat' && n.meta.catId === tx.categoryId && n.meta.day === day);
          if (!dup) {
            addNotification({
              type: 'budget', title: '分类预算超支', level: 'warn',
              message: `${catName} 本月已花 ${Util.fmtMoney(catSpent)}, 超出分类预算 ${Util.fmtMoney(catSpent - catBudget.amount)}。`,
              time: Date.now(), meta: { kind: 'cat', ym, day, catId: tx.categoryId, amount: catSpent, over: catSpent - catBudget.amount },
            });
          }
        }
      }
    }
  }

  return {
    load, save, clear, clearDemoData, getCurrentUser,
    on, off, emit,
    getAccounts, getAccount, addAccount, updateAccount, deleteAccount,
    getCategories, addCategory, deleteCategory,
    getCategoryById, getCategoryTree, getCategoryPath, getLeafCategories, getCategoryBreadcrumb,
    getTransactions, addTransaction, updateTransaction, deleteTransaction,
    totals, aggregate, getBalanceAfterTx, getBalanceAtTime,
    getEducationStages, addEducationStage, updateEducationStage, deleteEducationStage,
    getLiabilities, addLiability, updateLiability, deleteLiability,
    getBudgets, getBudgetForMonth, setBudget, deleteBudget,
    getNotifications, unreadNotificationCount, addNotification,
    markNotificationRead, markAllNotificationsRead, clearAllNotifications,
    getSettings, updateSettings,
    getPots, getPot, addPot, updatePot, deletePot,
    getRules, getRule, addRule, updateRule, deleteRule, runRules,
    log, getLogs, clearLogs,
    exportAll, importAll,
    seedDemoData,
  };
})();
