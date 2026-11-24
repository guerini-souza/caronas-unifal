import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { parseDirection } from "@/lib/direction";
import { todayInAppTz } from "@/lib/format";
import { getNeighborhoods } from "@/lib/queries";
import type { PickupPoint, Vehicle } from "@/lib/types";
import { OfferWizard } from "./OfferWizard";

export const metadata: Metadata = { title: "Oferecer carona" };

export default async function OferecerPage(props: PageProps<"/oferecer">) {
  const sp = await props.searchParams;
  const initialDirection = parseDirection(sp.sentido);
  const { supabase, user, profile } = await requireProfile();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, model, color, plate, active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle<Vehicle>();
  // Primeira vez oferecendo: cadastra o veículo antes.
  if (!vehicle) redirect("/veiculo?next=/oferecer");

  const [{ data: neighborhoods }, { data: points }] = await Promise.all([
    getNeighborhoods(supabase),
    supabase
      .from("pickup_points")
      .select("id, neighborhood_id, name, data_status, display_order")
      .eq("active", true)
      .order("display_order")
      .order("name"),
  ]);

  return (
    <OfferWizard
      key={initialDirection ?? "novo"}
      initialDirection={initialDirection}
      vehicle={vehicle}
      neighborhoods={neighborhoods}
      points={(points ?? []) as Pick<PickupPoint, "id" | "neighborhood_id" | "name">[]}
      defaultNeighborhoodId={profile.neighborhood_id}
      today={todayInAppTz()}
    />
  );
}
