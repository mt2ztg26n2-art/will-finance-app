window.WF_CONFIG = {
  SUPABASE_URL: 'https://naqcaaktfqdvsanghqbm.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_c-JchQzWlsLLz9N_HJoO3A_dDAqc1dB'
};

window.WF_CONFIG.isValid = function () {
  return !this.SUPABASE_URL.includes('YOUR-PROJECT')
      && !this.SUPABASE_ANON_KEY.includes('YOUR-ANON-KEY');
};
