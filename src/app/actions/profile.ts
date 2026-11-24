"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { normalizePhone, normalizePlate } from "@/lib/format";
import { safeNext } from "@/lib/safe-next";

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80, "Nome muito longo."),
  phone: z.string().transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "WhatsApp inválido. Ex.: (35) 99999-1234" });
      return z.NEVER;
    }
    return n;
  }),
  neighborhood_id: z.uuid("Escolha seu bairro."),
});

export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = profileSchema.safeParse({
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    neighborhood_id: formData.get("neighborhood_id") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Confira os campos.", fieldErrors };
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" });
  if (error) return { error: "Não foi possível salvar. Tente de novo." };

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next"), "/inicio"));
}

const vehicleSchema = z.object({
  model: z.string().trim().min(2, "Informe o modelo.").max(60, "Modelo muito longo."),
  color: z.string().trim().min(2, "Informe a cor.").max(30, "Cor muito longa."),
  plate: z.string().transform((v, ctx) => {
    const n = normalizePlate(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Placa inválida. Ex.: ABC1D23" });
      return z.NEVER;
    }
    return n;
  }),
});

export async function saveVehicle(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = vehicleSchema.safeParse({
    model: formData.get("model") ?? "",
    color: formData.get("color") ?? "",
    plate: formData.get("plate") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Confira os campos.", fieldErrors };
  }

  const { supabase, user } = await requireUser();
  const { data: existing } = await supabase
    .from("vehicles")
    .select("id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("vehicles").update(parsed.data).eq("id", existing.id)
    : await supabase.from("vehicles").insert({ user_id: user.id, ...parsed.data });
  if (error) return { error: "Não foi possível salvar o veículo. Tente de novo." };

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next"), "/perfil"));
}
