"use client";

import { useEffect, useState } from "react";
import { AppButton } from "@/components/AppButton";
import Image from "next/image";
import logo from "@/assets/logo.webp";
import { IconDownload } from "@/components/icons";
import { InstallSteps } from "@/components/InstallSteps";
import { usePwaInstall } from "@/components/usePwaInstall";

const DISMISS_KEY = "caronas.install-dismissed-at";
const SHOW_AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // pergunta de novo depois de 7 dias

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < SHOW_AGAIN_AFTER_MS;
  } catch {
    return false;
  }
}

/**
 * Aviso automático "Adicionar à tela inicial?" na primeira visita.
 * Android: abre a janela nativa. iPhone: mostra os passos (a Apple não permite abrir sozinho).
 */
export function InstallPrompt() {
  const { canPrompt, isInstalled, platform, inAppBrowser, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (isInstalled || platform === "other" || recentlyDismissed()) return;
    const t = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(t);
  }, [isInstalled, platform]);

  if (!open || isInstalled) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setOpen(false);
  }

  async function install() {
    if (await promptInstall()) {
      setOpen(false);
      return;
    }
    setShowSteps(true);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3" role="dialog" aria-labelledby="install-title" aria-modal="false">
      <div className="safe-bottom w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-border">
        <div className="flex items-center gap-4">
          <Image src={logo} alt="" width={56} height={56} className="shrink-0 rounded-2xl" />
          <div>
            <p id="install-title" className="text-lg font-extrabold leading-tight">
              Adicionar à tela inicial?
            </p>
            <p className="text-muted">Abra o Caronas como um app, com um toque.</p>
          </div>
        </div>

        {showSteps || (!canPrompt && platform === "ios") || inAppBrowser ? (
          <div className="mt-4 rounded-2xl bg-background p-4 text-base">
            <InstallSteps platform={platform} inAppBrowser={inAppBrowser} />
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <AppButton variant="ghost" size="md" onClick={dismiss}>
            Agora não
          </AppButton>
          {platform === "ios" || inAppBrowser ? (
            <AppButton variant="pegar" size="md" onClick={dismiss}>
              Entendi
            </AppButton>
          ) : (
            <AppButton variant="pegar" size="md" onClick={install} icon={<IconDownload className="h-5 w-5" />}>
              Instalar
            </AppButton>
          )}
        </div>
      </div>
    </div>
  );
}
