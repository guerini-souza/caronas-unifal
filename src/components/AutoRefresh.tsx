"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Atualiza a tela a cada 30 s (e ao voltar para o app) enquanto há carona acontecendo. */
export function AutoRefresh({ active, everyMs = 30_000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, everyMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [active, everyMs, router]);

  return null;
}
