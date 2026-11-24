import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Listener = (event: Record<string, unknown>) => void;
type Shown = { title: string; options: { body: string; tag?: string; data: { url: unknown } } };

/** Carrega public/sw.js com um `self` falso e devolve o que ele registrou/abriu. */
function loadServiceWorker(windows: { url: string; navigate?: (u: string) => Promise<void> }[] = []) {
  const listeners: Record<string, Listener> = {};
  const shown: Shown[] = [];
  const opened: string[] = [];
  const navigated: string[] = [];
  const self = {
    location: { origin: "https://app.test" },
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
    skipWaiting: () => {},
    registration: {
      showNotification: async (title: string, options: Shown["options"]) => {
        shown.push({ title, options });
      },
    },
    clients: {
      matchAll: async () =>
        windows.map((w) => ({
          url: w.url,
          focus: async () => {},
          postMessage: () => {},
          navigate: async (u: string) => {
            navigated.push(u);
            await w.navigate?.(u);
          },
        })),
      openWindow: async (u: string) => {
        opened.push(u);
      },
    },
  };
  new Function("self", readFileSync("public/sw.js", "utf8"))(self);
  return { listeners, shown, opened, navigated };
}

async function fire(listener: Listener, event: Record<string, unknown>) {
  let pending: Promise<unknown> = Promise.resolve();
  listener({ ...event, waitUntil: (p: Promise<unknown>) => (pending = p) });
  await pending;
}

async function pushThenClick(url: unknown, windows?: Parameters<typeof loadServiceWorker>[0]) {
  const sw = loadServiceWorker(windows);
  await fire(sw.listeners.push, { data: { json: () => ({ title: "Aviso", body: "Corpo", url, tag: "t" }) } });
  const { options } = sw.shown[0];
  await fire(sw.listeners.notificationclick, { notification: { data: options.data, close: () => {} } });
  return sw;
}

describe("service worker: notificação → toque", () => {
  it("abre a tela certa do app (lembrete e rota iniciada)", async () => {
    expect((await pushThenClick("/minhas-caronas/abc")).opened).toEqual(["https://app.test/minhas-caronas/abc"]);
    expect((await pushThenClick("/reservas")).opened).toEqual(["https://app.test/reservas"]);
  });

  it("com o app aberto, navega a janela existente", async () => {
    const sw = await pushThenClick("/minhas-caronas/abc", [{ url: "https://app.test/inicio" }]);
    expect(sw.navigated).toEqual(["https://app.test/minhas-caronas/abc"]);
    expect(sw.opened).toEqual([]);
  });

  it("mostra título e texto enviados", async () => {
    const sw = await pushThenClick("/reservas");
    expect(sw.shown[0].title).toBe("Aviso");
    expect(sw.shown[0].options.body).toBe("Corpo");
  });

  it.each(["//evil.com", "/..//evil.com", "/%2e%2e//evil.com", "/\t/evil.com", "https://evil.com/x", 42, undefined])(
    "endereço estranho (%j) abre o início",
    async (url) => {
      expect((await pushThenClick(url)).opened).toEqual(["https://app.test/inicio"]);
    },
  );
});
