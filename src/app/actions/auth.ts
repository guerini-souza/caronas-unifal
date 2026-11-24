"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string } | undefined;

const credentials = z.object({
  email: z.email("E-mail inválido.").max(254),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72),
});

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Acrescenta ?next= (já validado) a um caminho interno. */
function withNext(path: string, next: string) {
  if (!next) return path;
  return `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`;
}

/** Link do e-mail de confirmação: primeiro acesso e, se veio de um link de carona, volta para ela. */
async function confirmUrl(next: string) {
  return `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(withNext("/perfil", next))}`;
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (formData.get("password") !== formData.get("confirm")) {
    return { error: "As senhas não são iguais." };
  }

  const next = safeNext(formData.get("next"), "");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: await confirmUrl(next) },
  });
  if (error) {
    if (error.status === 429) return { error: "Muitas tentativas. Aguarde alguns minutos." };
    if (error.code === "weak_password") return { error: "Senha fraca. Use letras e números." };
    if (/sending .*email/i.test(error.message)) {
      return { error: "Não conseguimos enviar o e-mail de confirmação agora. Tente de novo em alguns minutos." };
    }
    return { error: "Não foi possível criar a conta. Tente de novo." };
  }
  // Se a confirmação de e-mail estiver desativada no Supabase, já vem sessão.
  if (data.session) redirect(withNext("/perfil?primeiro=1", next));
  redirect(withNext("/verificar-email", next));
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "E-mail ou senha inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") redirect(withNext("/verificar-email", safeNext(formData.get("next"), "")));
    if (error.status === 429) return { error: "Muitas tentativas. Aguarde alguns minutos." };
    return { error: "E-mail ou senha inválidos." };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function resendVerification(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "E-mail inválido." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.data,
    options: { emailRedirectTo: await confirmUrl(safeNext(formData.get("next"), "")) },
  });
  if (error?.status === 429) return { error: "Aguarde um pouco antes de reenviar." };
  // Resposta neutra (não revela se o e-mail existe).
  return { message: "Se houver uma conta pendente, enviamos um novo link." };
}

/** Envia link de redefinição de senha (resposta neutra: não revela se o e-mail existe). */
export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "E-mail inválido." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/nova-senha`,
  });
  if (error?.status === 429) return { error: "Aguarde um pouco antes de pedir de novo." };
  if (error && /sending .*email/i.test(error.message)) {
    return { error: "Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos." };
  }
  return { message: "Se o e-mail estiver cadastrado, enviamos um link para criar uma nova senha." };
}

const newPassword = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72);

/** Define a nova senha (usuário chega aqui logado pelo link do e-mail). */
export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = newPassword.safeParse(formData.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (formData.get("password") !== formData.get("confirm")) return { error: "As senhas não são iguais." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "O link expirou. Peça um novo em “Esqueci minha senha”." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    if (error.code === "same_password") return { error: "Use uma senha diferente da anterior." };
    if (error.code === "weak_password") return { error: "Senha fraca. Use letras e números." };
    return { error: "Não foi possível trocar a senha. Tente de novo." };
  }
  redirect("/inicio");
}
