/* Service worker trung tính - thay thế service worker quảng cáo cũ nếu còn cache. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});
