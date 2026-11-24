"use client";

import { useEffect } from "react";
import { reloadIfStaleDeploy } from "@/lib/stale-deploy";

// Último recurso (erro no layout raiz): HTML próprio, sem depender do CSS do app.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    reloadIfStaleDeploy(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f1f5f9", color: "#0f172a" }}>
        <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <div>
            <h1 style={{ fontSize: 24 }}>Algo deu errado</h1>
            <p>Toque abaixo para recarregar o app.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ marginTop: 16, minHeight: 56, padding: "0 28px", border: 0, borderRadius: 16, background: "#1d4ed8", color: "#fff", fontSize: 18, fontWeight: 700 }}
            >
              RECARREGAR
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
