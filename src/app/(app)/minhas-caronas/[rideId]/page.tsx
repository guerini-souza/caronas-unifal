import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ErrorMessage } from "@/components/States";
import { StepHeader } from "@/components/StepHeader";
import { requireProfile } from "@/lib/auth";
import { UUID_RE } from "@/lib/queries";
import { tripPhase } from "@/lib/trip";
import type { MyRide } from "@/lib/types";
import { RideItem } from "../RideItem";

export const metadata: Metadata = { title: "Sua carona" };
export const dynamic = "force-dynamic";

/** Uma carona do motorista (destino do lembrete de 10 min), com INICIEI A ROTA. */
export default async function MinhaCaronaPage(props: PageProps<"/minhas-caronas/[rideId]">) {
  const { rideId } = await props.params;
  if (!UUID_RE.test(rideId)) notFound();
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.rpc("get_my_rides", { p_ride_id: rideId });
  const ride = ((data ?? []) as MyRide[])[0];
  if (!error && !ride) notFound();

  return (
    <>
      <StepHeader title="Sua carona" backHref="/minhas-caronas" accent="oferecer" />
      {error ? <ErrorMessage>Não foi possível carregar sua carona.</ErrorMessage> : null}
      {ride ? <RideItem ride={ride} /> : null}
      <AutoRefresh active={ride !== undefined && (ride.status === "OPEN" || ride.status === "FULL") && tripPhase(ride.departure_at) === "open"} />
    </>
  );
}
