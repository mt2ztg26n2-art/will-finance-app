/* 个人金融系统 — Service Worker
   离线可用 + 可安装到 iOS / Android 主屏幕。
   策略: 导航请求网络优先(始终拿到最新 HTML), 其它同源资源缓存优先并后台更新。 */
const CACHE = 'will-finance-sw-v31';
const ASSETS = [
  './',
  './index.html',
  './styles/main.css',
  './styles/views.css',
  './vendor/chart.umd.js',
  './vendor/html2canvas.min.js',
  './vendor/jspdf.umd.min.js',
  './js/utils.js', './js/sync.config.js', './js/i18n.js', './js/data.js',
  './js/parsers.js', './js/auth.js', './js/router.js', './js/app.js', './js/sync.js',
  './js/mapPicker.js', './js/receipt.js',
  './js/views/dashboard.js', './js/views/quickInput.js', './js/views/transactions.js',
  './js/views/accounts.js', './js/views/budgets.js', './js/views/monthlyReport.js',
  './js/views/education.js', './js/views/entrepreneurship.js', './js/views/liabilities.js',
  './js/views/flow.js', './js/views/datacenter.js', './js/views/notifications.js',
  './js/views/settings.js', './js/views/pots.js',
  './js/views/audit.js', './js/views/yearlyReport.js',
  './manifest.webmanifest',
  './assets/icon.svg', './assets/icon-192.svg', './assets/icon-maskable.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 不缓存跨域(Supabase / 字体)

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { caches.open(CACHE).then((c) => c.put('./index.html', res.clone())); return res; })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        fetch(req).then((res) => {
          if (res && res.status === 200) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        }).catch(() => {});
        return cached;
      }
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match('./'));
    })
  );
});
