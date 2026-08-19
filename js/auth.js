/* =========================================================
   Auth — 登录/注册 (离线版)
   ========================================================= */

const Auth = (() => {
  // 演示账号默认密码(仅在用户从未注册过 demo 时生效)
  const DEMO_USER = 'demo';
  const DEMO_PASSWORD = 'demo123';

  // 预建演示账号(仅无登录态时调用, 复用 Data 写入完整结构, 避免数据缺字段)
  function ensureDemo() {
    const data = Data.load(DEMO_USER);
    if (!data.users[DEMO_USER]) {
      data.users[DEMO_USER] = {
        username: DEMO_USER,
        password: Util.hash(DEMO_PASSWORD),
        createdAt: Date.now(),
        isDemo: true,
      };
      Data.save();
    }
  }

  function init() {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      try {
        const { username } = JSON.parse(session);
        Data.load(username);
        return { username };
      } catch (e) { /* ignore */ }
    }
    // 无登录态时确保演示账号存在, 登录页可直接用 demo/demo123 体验
    try { ensureDemo(); } catch (e) {}
    return null;
  }

  // 登录: 严格校验密码, 不同账号各自隔离(各自 localStorage 命名空间 + 各自密码)
  function login(username, password) {
    if (!username || !password) {
      return { ok: false, error: '用户名和密码不能为空' };
    }
    const data = Data.load(username);
    let u = data.users[username];
    // 演示账号首次使用: 自动建号(固定 demo123), 仅此特例允许"不存在即创建"
    if (!u) {
      if (username === DEMO_USER) {
        u = data.users[DEMO_USER] = {
          username: DEMO_USER,
          password: Util.hash(DEMO_PASSWORD),
          createdAt: Date.now(),
          isDemo: true,
        };
        Data.save();
      } else {
        return { ok: false, error: '账号不存在, 请先注册', code: 'no_account' };
      }
    }
    // 密码校验(利用哈希比较, 本地不存明文)
    if (u.password !== Util.hash(password)) {
      return { ok: false, error: '密码错误' };
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username, remember: true }));
    // 仅演示账号且数据为空时预置演示数据; 其它账号各自从空白开始, 互不复制
    if (username === DEMO_USER && data.accounts.length === 0 && data.transactions.length === 0) {
      Data.seedDemoData();
    }
    return { ok: true };
  }

  // 注册: 每个新账号独立命名空间 + 独立密码; 可选密保问题(用于找回密码)
  function register(username, password, passwordConfirm, security) {
    if (!username || username.length < 2) return { ok: false, error: '用户名至少2位' };
    if (!password || password.length < 8) return { ok: false, error: '密码至少8位' };
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return { ok: false, error: '密码须包含字母与数字' };
    if (password !== passwordConfirm) return { ok: false, error: '两次密码不一致' };
    const data = Data.load(username);
    if (data.users[username]) return { ok: false, error: '该用户已存在' };
    const u = { username, password: Util.hash(password), createdAt: Date.now() };
    // 密保问题(选填即可, 但有则用于找回密码)
    if (security && security.q && security.a) {
      u.securityQ = security.q;
      u.securityA = Util.hash(String(security.a).trim().toLowerCase());
    }
    data.users[username] = u;
    Data.save();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username, remember: true }));
    // 仅演示账号预置演示数据; 其它账户留白, 各自记录自己的财务数据
    if (username === DEMO_USER) Data.seedDemoData();
    return { ok: true };
  }

  // 找回密码: 通过密保验证后重设(不登录态调用)
  function resetPassword(username, newPwd) {
    if (!username || !newPwd || newPwd.length < 8) return { ok: false, error: '新密码至少 8 位, 且包含字母与数字' };
    if (!/[A-Za-z]/.test(newPwd) || !/\d/.test(newPwd)) return { ok: false, error: '密码须包含字母与数字' };
    const data = Data.load(username);
    const u = data.users[username];
    if (!u) return { ok: false, error: '账号不存在' };
    u.password = Util.hash(newPwd);
    Data.save();
    return { ok: true };
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    Data.clear();
  }

  function getCurrentUser() {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) return null;
    try { return JSON.parse(session).username; } catch { return null; }
  }

  function changePassword(oldPwd, newPwd) {
    const username = getCurrentUser();
    if (!username) return { ok: false, error: '未登录' };
    const data = Data.load(username);
    const u = data.users[username];
    if (!u || !u.password) return { ok: false, error: '账户数据异常' };
    if (u.password !== Util.hash(oldPwd)) return { ok: false, error: '原密码错误' };
    if (!newPwd || newPwd.length < 8) return { ok: false, error: '新密码至少 8 位, 且包含字母与数字' };
    if (!/[A-Za-z]/.test(newPwd) || !/\d/.test(newPwd)) return { ok: false, error: '密码须包含字母与数字' };
    u.password = Util.hash(newPwd);
    Data.save();
    return { ok: true };
  }

  return { init, login, register, resetPassword, logout, getCurrentUser, changePassword, ensureDemo };
})();
