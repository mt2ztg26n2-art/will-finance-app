const Auth = (() => {
  let sb = null;

  function init(client) { sb = client; }

  async function signUp(email, password) {
    if (!sb) throw new Error('Supabase 未初始化');
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { emailRedirectTo: location.origin + location.pathname }
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    if (!sb) throw new Error('Supabase 未初始化');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function resetPassword(email) {
    if (!sb) throw new Error('Supabase 未初始化');
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname
    });
    if (error) throw error;
  }

  async function updatePassword(newPassword) {
    if (!sb) throw new Error('Supabase 未初始化');
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async function signOut() {
    if (!sb) return;
    await sb.auth.signOut();
  }

  async function currentUser() {
    if (!sb) return null;
    const { data } = await sb.auth.getUser();
    return data?.user || null;
  }

  async function currentSession() {
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data?.session || null;
  }

  function onAuthStateChange(cb) {
    if (!sb) return () => {};
    const { data } = sb.auth.onAuthStateChange((event, session) => cb(event, session));
    return () => data?.subscription?.unsubscribe?.();
  }

  return { init, signUp, signIn, resetPassword, updatePassword, signOut, currentUser, currentSession, onAuthStateChange };
})();

window.WF_Auth = Auth;
