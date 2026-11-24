// Variáveis públicas (inlined no bundle pelo Next). Nunca coloque secrets aqui.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Sao_Paulo";
// Deslocamento fixo do fuso (o Brasil não tem horário de verão desde 2019).
export const APP_UTC_OFFSET = process.env.NEXT_PUBLIC_APP_UTC_OFFSET || "-03:00";

/** Endereço público do app (links compartilhados e cartão do WhatsApp). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://app-caronas-seven.vercel.app")
).replace(/\/$/, "");

export function isSupabaseConfigured() {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
