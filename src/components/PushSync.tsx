"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { savePushSubscription } from "@/app/actions/push";
import { currentSubscription, pushSupported, subscriptionPayload } from "@/lib/push/client";

const SYNC_KEY = "caronas.push-sync";
const SYNC_EVERY_MS = 24 * 60 * 60 * 1000;

/**
 * Mantém este celular ligado à conta logada (1×/dia por conta) e atualiza a tela
 * quando chega uma notificação com o app aberto.
 */
export function PushSync({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!pushSupported()) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "push") router.refresh();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    (async () => {
      if (Notification.permission !== "granted") return;
      const subscription = await currentSubscription();
      if (!subscription) return;
      const mark = `${userId}:${subscription.endpoint}`;
      try {
        const last = JSON.parse(localStorage.getItem(SYNC_KEY) ?? "null") as { mark: string; at: number } | null;
        if (last && last.mark === mark && Date.now() - last.at < SYNC_EVERY_MS) return;
      } catch {}
      const res = await savePushSubscription(subscriptionPayload(subscription), navigator.userAgent);
      if (res.ok) {
        try {
          localStorage.setItem(SYNC_KEY, JSON.stringify({ mark, at: Date.now() }));
        } catch {}
      }
    })().catch(() => {});

    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router, userId]);

  return null;
}
