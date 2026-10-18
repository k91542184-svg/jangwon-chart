/* 장원 차트 오프라인·설치용 서비스 워커: 항상 인터넷의 최신 파일을 먼저 쓰고, 연결이 끊기면 마지막으로 받은 파일을 씁니다. */
const CACHE = 'jangwon-chart-v1';
const SHELL = ['./', './index.html', './pwa.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin, font = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) return;
  const key = same ? url.origin + url.pathname : req.url;
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key).then(r => r || (req.mode === 'navigate' ? caches.match(url.origin + url.pathname.replace(/[^/]*$/, '')) : undefined)).then(r => r || Response.error()))
  );
});
