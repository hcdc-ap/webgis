// Service Worker: cài đặt PWA + cache tài nguyên tĩnh để lần mở sau nhanh hơn.
// Chỉ cache: thư viện CDN, file nội bộ có ?v= (đổi version là tự lấy bản mới), thư mục icons/ và vendor/.
// KHÔNG đụng tới Supabase, tile bản đồ hay bất kỳ request nào khác (đi thẳng ra mạng như cũ).
// v3: bỏ cache cũ chứa phản hồi 'opaque' (no-cors) -> làm hỏng các thẻ <script integrity crossorigin> (SRI).
const CACHE = 'hcdc-static-v3';
const CDN_HOSTS = new Set([
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'cdn.sheetjs.com',
]);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

function isCacheable(url) {
  if (CDN_HOSTS.has(url.hostname)) return true;
  if (url.origin !== self.location.origin) return false;
  return (
    url.searchParams.has('v') ||
    url.pathname.includes('/icons/') ||
    url.pathname.includes('/vendor/')
  );
}

// Stale-while-revalidate: trả bản cache ngay, cập nhật nền cho lần sau.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!isCacheable(url)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      let cached = await cache.match(req);
      // Không bao giờ trả phản hồi opaque cho request CORS (script/css có integrity): sẽ bị trình duyệt từ chối.
      if (cached && cached.type === 'opaque' && req.mode === 'cors') cached = undefined;
      const network = fetch(req)
        .then((res) => {
          // Chỉ cache phản hồi đọc được (CORS/same-origin), không cache opaque.
          if (res && res.ok && res.type !== 'opaque') cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
