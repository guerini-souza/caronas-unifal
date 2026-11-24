// Service worker: instalação PWA, página offline e notificações (Web Push).
// Não faz cache de páginas autenticadas nem de dados (evita mostrar vagas desatualizadas).
// Navigation preload: o navegador já busca a página enquanto o service worker inicia,
// eliminando o atraso de "acordar" o SW a cada abertura do app.
const CACHE = "caronas-v4";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(event.request);
      } catch {
        return (await caches.match(OFFLINE_URL)) ?? Response.error();
      }
    })(),
  );
});

// Notificação enviada pelo servidor (lembrete, rota iniciada, chegada).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  // O endereço é validado uma vez só, no toque (notificationclick).
  const url = typeof data.url === "string" ? data.url : "/inicio";
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "Caronas UNIFAL", {
        body: data.body || "",
        icon: "/brand/icon-192.png",
        badge: "/brand/badge-96.png",
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        lang: "pt-BR",
        data: { url },
      });
      // App aberto: a tela atualiza sozinha (ex.: "motorista a caminho").
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      windows.forEach((w) => w.postMessage({ type: "push" }));
    })(),
  );
});

// Toque na notificação: abre (ou traz para frente) o app na tela certa.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeTarget(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin !== self.location.origin) continue;
        await w.focus();
        try {
          await w.navigate(target);
        } catch {
          await self.clients.openWindow(target);
        }
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// Só endereços do próprio app ("/..."); qualquer outra coisa abre o início.
// Recusa espaços/controles e caminhos que viram "//host" depois de normalizar (ex.: "/..//site").
function safeTarget(value) {
  const fallback = new URL("/inicio", self.location.origin).href;
  if (typeof value !== "string" || !value.startsWith("/") || /[\x00-\x20\x7f\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin && !url.pathname.startsWith("//") ? url.href : fallback;
  } catch {
    return fallback;
  }
}
