// Cài đặt Service Worker
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Đã cài đặt thành công!');
});

// Bỏ qua bộ nhớ đệm (Cache) để luôn tải dữ liệu mới nhất từ GitHub
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});
