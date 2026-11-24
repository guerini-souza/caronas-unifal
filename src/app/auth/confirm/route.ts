import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

/**
 * Link de confirmação de e-mail. Suporta os dois formatos do Supabase:
 *  - ?code=...                 (fluxo PKCE padrão)
 *  - ?token_hash=...&type=...  (template de e-mail customizado)
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"), "/perfil");
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return to(next);
    return to(next === "/nova-senha" ? "/esqueci-senha?erro=1" : "/verificar-email?erro=1");
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return to(next);
    // Link aberto em outro navegador/dispositivo: a sessão não pode ser criada aqui.
    if (next === "/nova-senha") return to("/esqueci-senha?erro=1");
    // Cadastro: o e-mail já foi confirmado pelo Supabase. Basta entrar.
    return to(`/entrar?confirmado=1&next=${encodeURIComponent(next)}`);
  }

  return to("/entrar");
}
