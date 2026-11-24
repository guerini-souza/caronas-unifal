"use client";

import { useState } from "react";
import { AppButton } from "@/components/AppButton";
import { IconDownload } from "@/components/icons";
import { InstallSteps } from "@/components/InstallSteps";
import { usePwaInstall } from "@/components/usePwaInstall";

/** INSTALAR APP: usa o prompt nativo quando existe; senão mostra instruções. */
export function InstallPWAButton() {
  const { canPrompt, isInstalled, platform, inAppBrowser, promptInstall } = usePwaInstall();
  const [showHelp, setShowHelp] = useState(false);

  if (isInstalled) return null;

  async function install() {
    if (await promptInstall()) return;
    setShowHelp((v) => !v);
  }

  return (
    <div>
      <AppButton variant="neutral" onClick={install} icon={<IconDownload />} aria-expanded={canPrompt ? undefined : showHelp}>
        INSTALAR APP
      </AppButton>
      {showHelp ? (
        <div className="mt-3 rounded-2xl bg-surface p-4 text-left text-base shadow-sm" role="region" aria-label="Como instalar">
          <InstallSteps platform={platform} inAppBrowser={inAppBrowser} />
        </div>
      ) : null}
    </div>
  );
}
