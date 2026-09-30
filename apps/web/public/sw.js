/*
 * 서비스 워커 (09 문서 8절).
 * - 공개 정적 자원만 캐시한다. 결제·인증·주문·업무 API 응답은 캐시하지 않는다.
 * - 페이지 요청은 네트워크 우선, 실패하면 오프라인 안내 화면. 오프라인 예약증은 IndexedDB 사본을 그 화면이 보여 준다.
 * - 새 버전은 결제 중 강제 새로고침하지 않는다 (다음 방문 때 적용).
 * - 웹 푸시: 서버가 보낸 제목·본문·링크만 표시한다.
 */
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/fonts/PretendardVariable.woff2"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isCacheableStatic(url) {
  return url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/fonts/"));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API·인증·결제는 항상 네트워크 (캐시 금지)
  if (url.pathname.startsWith("/api/")) return;

  if (isCacheableStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    // 페이지(개인 정보 포함 가능)는 캐시하지 않는다. 연결이 없으면 오프라인 안내.
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = typeof payload.title === "string" ? payload.title.slice(0, 120) : "제주 커넥트";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 300) : "";
  const url = typeof payload.url === "string" && payload.url.startsWith("/") ? payload.url : "/";
  event.waitUntil(self.registration.showNotification(title, { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).pathname === url && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
