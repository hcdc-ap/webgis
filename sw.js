// Service Worker tối giản (đủ điều kiện cài PWA). Không có fetch handler nên không chặn/đổi hướng request nào
// và không phát sinh cảnh báo "no-op fetch handler".
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
