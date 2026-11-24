/**
 * Erros típicos de quando o site foi atualizado com a tela aberta
 * (código antigo no celular conversando com o servidor novo).
 */
const STALE_RE = /Server Action|Failed to find|ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|deployment/i;
const KEY = "caronas.auto-reload-at";

/** Recarrega a página uma vez (no máximo a cada 30 s) se o erro parece ser de versão antiga. */
export function reloadIfStaleDeploy(error: Error): boolean {
  if (typeof window === "undefined" || !STALE_RE.test(`${error?.name} ${error?.message}`)) return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // sem sessionStorage: recarrega mesmo assim
  }
  window.location.reload();
  return true;
}
