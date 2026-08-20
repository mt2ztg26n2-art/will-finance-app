const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const WebSocket = globalThis.WebSocket;

const DIR = 'C:/Users/AKA-33/WorkBuddy AI/2026-08-05-22-44-28/finance-system';
const PY = 'C:/Users/AKA-33/.workbuddy/binaries/python/versions/3.13.12/python.exe';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SRV_PORT = 8805, CDP_PORT = 9231;
const TARGET = `http://127.0.0.1:${SRV_PORT}/index.html`;
const PROFILE = path.join(DIR, '.cdp-iso');

function getJSON(u){return new Promise((res,rej)=>{const req=http.get(u,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d))}catch(e){rej(e)}});});req.on('error',rej);});}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // 启动静态服务器
  fs.rmSync(PROFILE, { recursive: true, force: true });
  fs.mkdirSync(PROFILE, { recursive: true });
  const srv = spawn(PY, ['-m', 'http.server', String(SRV_PORT), '--bind', '127.0.0.1'], { cwd: DIR, stdio: 'ignore' });
  // 启动隔离 chrome
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
    '--window-size=1280,900', 'about:blank'
  ], { stdio: 'ignore' });

  const cleanup = () => { try { srv.kill('SIGKILL'); } catch(e){} try { chrome.kill('SIGKILL'); } catch(e){} try { fs.rmSync(PROFILE, {recursive:true,force:true}); } catch(e){} };
  process.on('exit', cleanup);

  // 等 chrome
  let list = null;
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try { list = await getJSON(`http://127.0.0.1:${CDP_PORT}/json`); if (list && list.length) break; } catch(e){}
  }
  if (!list || !list.length) { console.log('CHROME_FAIL'); cleanup(); process.exit(1); }
  const page = list.find(t => t.type === 'page') || list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const q = []; let id = 0;
  const send = (m, p = {}) => new Promise(res => { const mid = ++id; q.push({ mid, res }); ws.send(JSON.stringify({ id: mid, method: m, params: p })); });
  ws.addEventListener('message', m => { const o = JSON.parse(m.data); if (o.id) { const it = q.find(x => x.mid === o.id); if (it) { q.splice(q.indexOf(it), 1); it.res(o.result); } } });
  await new Promise(r => ws.addEventListener('open', r));
  const logs = [];
  ws.addEventListener('message', m => { const o = JSON.parse(m.data);
    if (o.method === 'Runtime.exceptionThrown') logs.push('EXC:' + (o.params.exceptionDetails.exception && o.params.exceptionDetails.exception.description));
    if (o.method === 'Runtime.consoleAPICalled' && o.params.type === 'error') logs.push('CERR:' + (o.params.args||[]).map(a=>a.value||a.description||'').join(' '));
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Network.setBlockedURLs', { urls: ['*service-worker.js*'] });
  const ev = (e) => send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });

  await send('Page.navigate', { url: TARGET }); await sleep(1500);
  // 等 app.js 真正执行(暴露 window.refreshShellSummary)
  let ready = null;
  for (let i = 0; i < 15; i++) {
    await sleep(800);
    ready = await ev(`(async()=>{return{ok:!!document.getElementById('login-form')&&typeof Auth!=='undefined'&&typeof Data!=='undefined'&&typeof window.refreshShellSummary==='function'&&!!document.querySelector('script[src*="app.js"]')};})()`);
    ready = ready.result.value;
    if (ready.ok) break;
  }
  console.log('READY', JSON.stringify(ready));
  if (!ready.ok) { console.log('LOGS', JSON.stringify(logs.slice(0,10))); cleanup(); process.exit(2); }

  // 登录 demo
  const login = await ev(`(async()=>{
    document.getElementById('login-username').value='demo';
    document.getElementById('login-password').value='demo123';
    document.querySelector('#login-form button[type="submit"]').click();
    await new Promise(r=>setTimeout(r,1200));
    return { appHidden:document.getElementById('app').classList.contains('hidden'), loginHidden:document.getElementById('login-screen').classList.contains('hidden'), currentUser:Auth.getCurrentUser(), loginErr:document.getElementById('login-error').textContent };
  })()`);
  console.log('LOGIN', JSON.stringify(login.result.value));

  // 设置页: 安全密钥字段 + 保存回环
  const S = await ev(`(async()=>{
    Router.navigate('settings'); await new Promise(r=>setTimeout(r,700));
    const field=document.getElementById('set-amap-security'); const save=document.getElementById('set-amap-save');
    if(!field||!save) return {hasField:!!field, hasSettingsView:!!document.querySelector('.setting-row')};
    document.getElementById('set-amap-key').value='KTEST123'; field.value='STEST456'; save.click();
    await new Promise(r=>setTimeout(r,200));
    const st=Data.getSettings();
    return {hasField:true, savedKey:st.amapKey, savedSec:st.amapSecurity};
  })()`);
  console.log('SETTINGS', JSON.stringify(S.result.value));

  // 地图: 验证 _AMapSecurityConfig + 脚本注入(不依赖外网渲染)
  const M = await ev(`(async()=>{
    Data.updateSettings({amapKey:'KTEST123', amapSecurity:'STEST456'});
    const gs = Data.getSettings();
    const amapBefore = typeof window.AMap;
    let err=null; try { window.__mp=Util.openMapPicker({onSelect(){}}); } catch(e){ err=e.message; }
    const secImmediate = window._AMapSecurityConfig?window._AMapSecurityConfig.securityJsCode:null;
    await new Promise(r=>setTimeout(r,400));
    const sec=window._AMapSecurityConfig?window._AMapSecurityConfig.securityJsCode:null;
    const script=document.querySelector('script[src*="webapi.amap.com"]');
    return {err, amapBefore, gsKey:gs.amapKey, gsSec:gs.amapSecurity, omDebug:window.__omDebug, secImmediate, secConfig:sec, hasScript:!!script, scriptHasKey:script?script.src.indexOf('KTEST123')!==-1:false, mpConfirm:!!document.getElementById('mp-confirm')};
  })()`);
  console.log('MAP', JSON.stringify(M.result.value));

  console.log('LOGS', JSON.stringify(logs.slice(0,10)));
  const l=login.result.value, s=S.result.value, m=M.result.value;
  const pass = !l.appHidden && l.currentUser==='demo' && s.hasField && s.savedKey==='KTEST123' && s.savedSec==='STEST456' && m.secConfig==='STEST456' && m.hasScript && m.scriptHasKey && m.mpConfirm && !m.err && logs.length===0;
  console.log('RESULT', pass?'PASS':'FAIL');
  cleanup(); process.exit(pass?0:3);
})().catch(e => { console.error('ERR', e); process.exit(1); });
