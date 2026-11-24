// Detecção de aparelho no navegador (chamar só no cliente).
export type Platform = "ios" | "android" | "other";

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

/** Navegador embutido de apps (Instagram, Facebook...), onde não dá para instalar. */
export function detectInAppBrowser(): boolean {
  return /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|; wv\)/i.test(navigator.userAgent);
}

/** Aberto como app instalado (tela inicial). */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
