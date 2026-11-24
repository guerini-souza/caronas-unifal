import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string | null;
  neighborhood_id: string | null;
};

export type SessionUser = { id: string; email: string | null };

/**
 * Usuário logado; senão redireciona.
 * getClaims valida a assinatura do token localmente (chaves assimétricas do Supabase),
 * sem ida ao servidor de Auth a cada página. Com "Confirm email" ativo, o Supabase só
 * emite sessão para e-mail verificado — e o banco confere de novo (assert_ready_user).
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/entrar");
  const user: SessionUser = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
  return { supabase, user };
}

/** Usuário pronto para usar o app (perfil completo); senão manda para /perfil (e volta para `nextPath`). */
export async function requireProfile(nextPath?: string) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, user_id, name, phone, email, neighborhood_id")
    .eq("user_id", user.id)
    .maybeSingle<Profile>();
  if (!profile) redirect(nextPath ? `/perfil?primeiro=1&next=${encodeURIComponent(nextPath)}` : "/perfil?primeiro=1");
  return { supabase, user, profile };
}
