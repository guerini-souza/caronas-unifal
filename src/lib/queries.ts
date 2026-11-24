import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Neighborhood, PickupPoint } from "@/lib/types";

// Consultas das telas dos alunos: só bairros/pontos ativos (o admin também enxerga os desativados).
const POINT_COLUMNS =
  "id, neighborhood_id, name, address, latitude, longitude, image_url, description, data_status, display_order";

export async function getNeighborhoods(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("neighborhoods").select("id, name").eq("active", true).order("name");
  return { data: (data ?? []) as Neighborhood[], error };
}

export async function getNeighborhood(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("neighborhoods").select("id, name").eq("id", id).eq("active", true).maybeSingle();
  return data as Neighborhood | null;
}

export async function getPickupPoints(supabase: SupabaseClient, neighborhoodId: string) {
  const { data, error } = await supabase
    .from("pickup_points")
    .select(POINT_COLUMNS)
    .eq("neighborhood_id", neighborhoodId)
    .eq("active", true)
    .order("display_order")
    .order("name");
  return { data: (data ?? []) as PickupPoint[], error };
}

export async function getPickupPoint(supabase: SupabaseClient, id: string) {
  // Bairro oculto esconde os pontos dele também.
  const { data } = await supabase
    .from("pickup_points")
    .select(`${POINT_COLUMNS}, neighborhoods!inner(active)`)
    .eq("id", id)
    .eq("active", true)
    .eq("neighborhoods.active", true)
    .maybeSingle();
  return data as PickupPoint | null;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
