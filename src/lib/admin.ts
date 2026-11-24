import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SUPABASE_URL } from "@/lib/env";

export const PHOTO_BUCKET = "pontos";
export const PHOTO_PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/`;

/** Conta listada em app_admins com e-mail confirmado (conferido no banco). */
export async function isAdmin(supabase: SupabaseClient) {
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}

/** Páginas do painel: para quem não é admin, a página "não existe". */
export async function requireAdmin() {
  const { supabase, user } = await requireUser();
  if (!(await isAdmin(supabase))) notFound();
  return { supabase, user };
}
