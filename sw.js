// Service Worker tối giản (đủ điều kiện cài PWA). KHÔNG chặn/đổi hướng request nào:
// trình duyệt tự tải mạng như bình thường -> không còn lỗi "Failed to fetch" khi CDN/mạng chập chờn.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
