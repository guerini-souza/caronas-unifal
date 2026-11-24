"use server";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PHOTO_BUCKET, PHOTO_PUBLIC_PREFIX, isAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { parseCoordinates } from "@/lib/geo";
import { PHOTO_MAX_BYTES, sniffImage } from "@/lib/image";

export type AdminFormState = { error?: string; message?: string; fieldErrors?: Record<string, string> } | undefined;

const NO_PERMISSION = { error: "Só a conta oficial pode fazer isso." };
const SAVE_FAILED = { error: "Não foi possível salvar. Tente de novo." };

/** Cliente do usuário logado se ele for admin. O banco confere de novo (RLS). */
async function adminClient() {
  const { supabase } = await requireUser();
  return (await isAdmin(supabase)) ? supabase : null;
}

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/pontos", "layout");
}

const optionalText = (max: number) =>
  z.string().trim().max(max, `Máximo de ${max} caracteres.`).transform((v) => v || null);

// ---------------------------------------------------------------------
// Bairros
// ---------------------------------------------------------------------
const neighborhoodName = z.string().trim().min(2, "Informe o nome do bairro.").max(80, "Nome muito longo.");

export async function createNeighborhood(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const name = neighborhoodName.safeParse(formData.get("name") ?? "");
  if (!name.success) return { error: name.error.issues[0].message };
  const supabase = await adminClient();
  if (!supabase) return NO_PERMISSION;

  const { data, error } = await supabase.from("neighborhoods").insert({ name: name.data }).select("id").single();
  if (error) return error.code === "23505" ? { error: "Já existe um bairro com esse nome." } : SAVE_FAILED;
  refresh();
  redirect(`/admin/bairro/${data.id}`);
}

export async function updateNeighborhood(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const id = z.uuid().safeParse(formData.get("id"));
  const name = neighborhoodName.safeParse(formData.get("name") ?? "");
  if (!id.success) return SAVE_FAILED;
  if (!name.success) return { error: name.error.issues[0].message };
  const supabase = await adminClient();
  if (!supabase) return NO_PERMISSION;

  const { error } = await supabase
    .from("neighborhoods")
    .update({ name: name.data, active: formData.get("active") === "on" })
    .eq("id", id.data);
  if (error) return error.code === "23505" ? { error: "Já existe um bairro com esse nome." } : SAVE_FAILED;
  refresh();
  return { message: "Bairro salvo." };
}

// ---------------------------------------------------------------------
// Pontos
// ---------------------------------------------------------------------
const pointSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do ponto.").max(80, "Nome muito longo."),
  address: optionalText(200),
  description: optionalText(500),
  location: z
    .string()
    .trim()
    .max(500)
    .transform((v, ctx) => {
      if (!v) return null;
      const c = parseCoordinates(v);
      if (!c) {
        ctx.addIssue({ code: "custom", message: "Localização inválida. Ex.: -21.7876, -46.5613" });
        return z.NEVER;
      }
      return c;
    }),
});

type Photo = { bytes: Uint8Array; type: string; ext: string };

async function readPhoto(value: FormDataEntryValue | null): Promise<Photo | null | "invalid"> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > PHOTO_MAX_BYTES) return "invalid";
  const bytes = new Uint8Array(await value.arrayBuffer());
  const kind = sniffImage(bytes);
  return kind ? { bytes, ...kind } : "invalid";
}

function photoPath(url: string | null) {
  return url?.startsWith(PHOTO_PUBLIC_PREFIX) ? url.slice(PHOTO_PUBLIC_PREFIX.length) : null;
}

async function removePhoto(supabase: SupabaseClient, url: string | null) {
  const path = photoPath(url);
  if (path) await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

/** Cria (com neighborhood_id) ou edita (com id) um ponto, incluindo a foto. */
export async function savePoint(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const parsed = pointSchema.safeParse({
    name: formData.get("name") ?? "",
    address: formData.get("address") ?? "",
    description: formData.get("description") ?? "",
    location: formData.get("location") ?? "",
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) fe[String(issue.path[0])] ??= issue.message;
    return { error: "Confira os campos.", fieldErrors: fe };
  }
  const supabase = await adminClient();
  if (!supabase) return NO_PERMISSION;
  const photo = await readPhoto(formData.get("photo"));
  if (photo === "invalid") return { error: "Foto inválida. Use uma foto JPG, PNG ou WebP.", fieldErrors: { photo: "Foto inválida." } };

  const editId = z.uuid().safeParse(formData.get("id"));
  let neighborhoodId: string;
  let oldImage: string | null = null;
  let displayOrder: number | null = null;

  if (editId.success) {
    const { data: current } = await supabase
      .from("pickup_points").select("neighborhood_id, image_url").eq("id", editId.data).maybeSingle();
    if (!current) return { error: "Ponto não encontrado." };
    neighborhoodId = current.neighborhood_id;
    oldImage = current.image_url;
  } else {
    const hood = z.uuid().safeParse(formData.get("neighborhood_id"));
    if (!hood.success) return SAVE_FAILED;
    neighborhoodId = hood.data;
    const { data: last } = await supabase
      .from("pickup_points").select("display_order").eq("neighborhood_id", neighborhoodId)
      .order("display_order", { ascending: false }).limit(1).maybeSingle();
    displayOrder = (last?.display_order ?? 0) + 1;
  }

  // Foto nova primeiro; se o banco recusar, ela é apagada.
  let imageUrl = formData.get("remove_photo") === "1" ? null : oldImage;
  let uploadedPath: string | null = null;
  if (photo) {
    uploadedPath = `${randomUUID()}.${photo.ext}`;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(uploadedPath, photo.bytes, { contentType: photo.type, cacheControl: "31536000", upsert: false });
    if (error) return { error: "Não foi possível enviar a foto. Tente de novo." };
    imageUrl = `${PHOTO_PUBLIC_PREFIX}${uploadedPath}`;
  }

  const { name, address, description, location } = parsed.data;
  const fields = {
    name,
    address,
    description,
    latitude: location?.lat ?? null,
    longitude: location?.lng ?? null,
    image_url: imageUrl,
  };
  const { error } = editId.success
    ? await supabase
        .from("pickup_points")
        .update({ ...fields, active: formData.get("active") === "on" })
        .eq("id", editId.data)
    : await supabase
        .from("pickup_points")
        .insert({ ...fields, neighborhood_id: neighborhoodId, display_order: displayOrder, active: true });

  if (error) {
    if (uploadedPath) await supabase.storage.from(PHOTO_BUCKET).remove([uploadedPath]);
    return error.code === "23505" ? { error: "Já existe um ponto com esse nome neste bairro." } : SAVE_FAILED;
  }
  if (oldImage && oldImage !== imageUrl) await removePhoto(supabase, oldImage);

  refresh();
  redirect(`/admin/bairro/${neighborhoodId}?salvo=1`);
}

/** Sobe ou desce um ponto na lista do bairro (ordem mostrada aos alunos). */
export async function movePoint(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  const dir = formData.get("dir") === "up" ? -1 : 1;
  if (!id.success) return;
  const supabase = await adminClient();
  if (!supabase) return;

  const { data: point } = await supabase.from("pickup_points").select("neighborhood_id").eq("id", id.data).maybeSingle();
  if (!point) return;
  const { data: points } = await supabase
    .from("pickup_points").select("id, display_order").eq("neighborhood_id", point.neighborhood_id)
    .order("display_order").order("name");
  const list = points ?? [];
  const from = list.findIndex((p) => p.id === id.data);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= list.length) return;
  [list[from], list[to]] = [list[to], list[from]];

  // Renumera 1..N (corrige empates antigos) e grava só o que mudou.
  await Promise.all(
    list.map((p, i) =>
      p.display_order === i + 1
        ? null
        : supabase.from("pickup_points").update({ display_order: i + 1 }).eq("id", p.id),
    ),
  );
  refresh();
}
