// Fantasy Golf service worker — minimal push notification handler.
// Registered from layout via /manifest.json. Catches push events when the
// tab is hidden and shows a system notification.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (_event) => {
  _event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "Fantasy Golf", body: "You have a new update", url: "/" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Fantasy Golf", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "fantasy-golf",
      renotify: true,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      // Focus any existing tab first, then navigate
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
