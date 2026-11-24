import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { searchDefaults } from "@/lib/format";
import { getNeighborhoods } from "@/lib/queries";
import type { PickupPoint } from "@/lib/types";
import { PegarClient } from "./PegarClient";

export const metadata: Metadata = { title: "Pegar carona" };

/** Carrega bairros e pontos uma vez; as etapas rodam no celular (ver PegarWizard). */
export default async function PegarPage() {
  const { supabase } = await requireProfile();
  const [{ data: neighborhoods }, { data: points }] = await Promise.all([
    getNeighborhoods(supabase),
    supabase.from("pickup_points").select("id, neighborhood_id, name").eq("active", true).order("display_order").order("name"),
  ]);
  const d = searchDefaults();

  return (
    <PegarClient
      neighborhoods={neighborhoods}
      points={(points ?? []) as Pick<PickupPoint, "id" | "neighborhood_id" | "name">[]}
      today={d.today}
      tomorrow={d.tomorrow}
      suggestedTime={d.time}
    />
  );
}
