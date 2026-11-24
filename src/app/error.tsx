"use client";

import { useEffect } from "react";
import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/States";
import { reloadIfStaleDeploy } from "@/lib/stale-deploy";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reloadIfStaleDeploy(error);
  }, [error]);

  return (
    <main className="px-5 pt-16">
      <EmptyState
        title="Algo deu errado"
        description="Verifique sua internet e tente de novo."
        action={
          <div className="space-y-3">
            <AppButton onClick={reset} variant="pegar">
              TENTAR DE NOVO
            </AppButton>
            <AppButton onClick={() => window.location.reload()} variant="ghost">
              RECARREGAR PÁGINA
            </AppButton>
          </div>
        }
      />
    </main>
  );
}
