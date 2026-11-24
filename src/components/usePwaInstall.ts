"use client";

import { useSyncExternalStore } from "react";
import { type Platform, detectInAppBrowser, detectPlatform, isStandalone } from "@/lib/device";

export type { Platform };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const noop = () => () => {};

// O evento pode disparar antes do componente montar: guardamos num pequeno store de módulo.
let savedPrompt: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    savedPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installedNow = true;
    savedPrompt = null;
    emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Estado e ação de instalação do PWA, compartilhados pelo botão e pelo aviso automático. */
export function usePwaInstall() {
  const deferred = useSyncExternalStore(subscribe, () => savedPrompt, () => null);
  const installed = useSyncExternalStore(subscribe, () => installedNow, () => false);
  const standalone = useSyncExternalStore(noop, isStandalone, () => false);
  const platform = useSyncExternalStore(noop, detectPlatform, () => "other" as Platform);
  const inAppBrowser = useSyncExternalStore(noop, detectInAppBrowser, () => false);

  /** Abre a janela nativa de instalação. Retorna false se o navegador não oferece. */
  async function promptInstall(): Promise<boolean> {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") installedNow = true;
    savedPrompt = null;
    emit();
    return true;
  }

  return {
    canPrompt: Boolean(deferred),
    isInstalled: standalone || installed,
    platform,
    inAppBrowser,
    promptInstall,
  };
}
