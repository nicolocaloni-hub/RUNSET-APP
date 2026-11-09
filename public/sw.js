// Service worker di RunSet: mostra le notifiche push anche con l'app chiusa.
// Non mette nulla in cache, così l'app resta sempre quella pubblicata.
self.addEventListener("push", (event) => {
  let message = { title: "RunSet", body: "" };
  try {
    message = event.data ? event.data.json() : message;
  } catch {
    message.body = event.data ? event.data.text() : "";
  }
  event.waitUntil(
    self.registration.showNotification(message.title || "RunSet", {
      body: message.body,
      tag: message.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => "focus" in w);
      return open ? open.focus() : self.clients.openWindow("/");
    }),
  );
});
