"use client";

import { useEffect, useState } from "react";
import { savePushSubscription } from "@/app/actions/push";
import { AppButton } from "@/components/AppButton";
import { IconBell } from "@/components/icons";
import { InstallSteps } from "@/components/InstallSteps";
import { ErrorMessage, SuccessMessage } from "@/components/States";
import { detectInAppBrowser } from "@/lib/device";
import { type PushState, enablePush, fetchPublicKey, getPushState, subscriptionPayload } from "@/lib/push/client";

export type PromptContext = "inicio" | "publicado" | "reservado" | "perfil";

const TEXT: Record<PromptContext, string> = {
  inicio: "Receba o lembrete das suas caronas e saiba quando o motorista sair.",
  publicado: "Receba o lembrete 10 minutos antes e saiba quando os passageiros chegarem ao ponto.",
  reservado: "Saiba na hora quando o motorista iniciar a rota.",
  perfil: "Lembrete das suas caronas e avisos de rota e de chegada.",
};

const DISMISS_KEY = "caronas.push-dismissed-at";
const SHOW_AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function dismissedRecently() {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < SHOW_AGAIN_AFTER_MS;
  } catch {
    return false;
  }
}

/** Cartão "Ative as notificações". Some quando já estão ativas (no Perfil mostra o status). */
export function NotificationPrompt({ context }: { context: PromptContext }) {
  const [state, setState] = useState<PushState | "loading" | "hidden">("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justEnabled, setJustEnabled] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const current = await getPushState();
      if (!alive) return;
      if (context === "inicio" && current !== "on" && dismissedRecently()) return setState("hidden");
      setState(current);
      // A chave vem antes do toque: no iPhone a permissão precisa ser pedida direto no clique.
      if (current === "off") {
        const key = await fetchPublicKey();
        if (alive) setPublicKey(key);
      }
    })();
    return () => {
      alive = false;
    };
  }, [context]);

  if (state === "loading" || state === "hidden") return null;
  if (state === "on") {
    return context === "perfil" || justEnabled ? <SuccessMessage>Notificações ativadas neste celular.</SuccessMessage> : null;
  }
  if (state === "unsupported") {
    return context === "perfil" ? <p className="text-muted">Este navegador não recebe notificações.</p> : null;
  }
  if (state === "needs-update") {
    return context === "inicio" ? null : (
      <p className="rounded-2xl bg-background p-4 text-base">Para receber notificações, atualize o iPhone para o iOS 16.4 ou mais novo.</p>
    );
  }
  if (state === "denied") {
    return context === "inicio" ? null : (
      <p className="rounded-2xl bg-background p-4 text-base">
        As notificações estão bloqueadas. Para ligar, abra as configurações do navegador (ou do app) e permita <b>Notificações</b> para o
        Caronas.
      </p>
    );
  }

  async function activate() {
    setError(null);
    if (!publicKey) return setError("Não foi possível ativar agora. Tente de novo em instantes.");
    setBusy(true);
    try {
      const subscription = await enablePush(publicKey);
      const res = await savePushSubscription(subscriptionPayload(subscription), navigator.userAgent);
      if (!res.ok) throw new Error("save");
      setJustEnabled(true);
      setState("on");
    } catch (e) {
      const reason = e instanceof Error ? e.message : "";
      if (reason === "denied") setState("denied");
      else if (reason !== "dismissed") setError("Não foi possível ativar agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setState("hidden");
  }

  return (
    <section className="rounded-2xl border-2 border-pegar bg-pegar-soft p-4" aria-labelledby={`push-${context}`}>
      <div className="flex items-start gap-3">
        <IconBell className="mt-0.5 h-7 w-7 shrink-0 text-pegar" />
        <div>
          <h2 id={`push-${context}`} className="text-lg font-extrabold">
            Ative as notificações
          </h2>
          <p className="mt-1 text-base">{TEXT[context]}</p>
        </div>
      </div>
      {state === "needs-install" ? (
        <div className="mt-3 rounded-xl bg-surface p-3 text-base">
          <p className="mb-2 font-bold">No iPhone, primeiro instale o app:</p>
          <InstallSteps platform="ios" inAppBrowser={detectInAppBrowser()} />
          <p className="mt-2">Depois abra pelo ícone na tela inicial e toque em ATIVAR NOTIFICAÇÕES.</p>
        </div>
      ) : (
        <div className="mt-4">
          <AppButton variant="pegar" onClick={activate} disabled={busy} aria-busy={busy}>
            {busy ? "ATIVANDO..." : "ATIVAR NOTIFICAÇÕES"}
          </AppButton>
        </div>
      )}
      {context === "inicio" ? (
        <div className="mt-3">
          <AppButton variant="ghost" size="md" onClick={dismiss}>
            Agora não
          </AppButton>
        </div>
      ) : null}
      <div className="mt-3">
        <ErrorMessage>{error}</ErrorMessage>
      </div>
    </section>
  );
}
