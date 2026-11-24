/**
 * Aceita somente caminhos internos para redirecionar após login/cadastro.
 * Rejeita "//host", "/\host" e caracteres de controle/espaço (ex.: "/\t/evil.com",
 * que o navegador normaliza para "//evil.com"), e também caminhos que viram "//host"
 * depois de normalizar "." e ".." (ex.: "/..//evil.com").
 */
export function safeNext(value: unknown, fallback = "/inicio"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return fallback;
  if (!value.startsWith("/") || /[\x00-\x20\x7f\\]/.test(value)) return fallback;
  try {
    const base = "http://app.local";
    const url = new URL(value, base);
    if (url.origin !== base || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
