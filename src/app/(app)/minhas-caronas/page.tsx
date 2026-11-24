import type { Metadata } from "next";
import { AppButton } from "@/components/AppButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { EmptyState, ErrorMessage } from "@/components/States";
import { StepHeader } from "@/components/StepHeader";
import { requireProfile } from "@/lib/auth";
import { tripPhase } from "@/lib/trip";
import type { MyRide } from "@/lib/types";
import { RideItem } from "./RideItem";

export const metadata: Metadata = { title: "Minhas caronas" };
export const dynamic = "force-dynamic";

export default async function MinhasCaronasPage() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.rpc("get_my_rides");
  const rides = (data ?? []) as MyRide[];
  const live = rides.some((r) => (r.status === "OPEN" || r.status === "FULL") && tripPhase(r.departure_at) === "open");

  return (
    <>
      <StepHeader title="Minhas caronas" subtitle="Caronas que você ofereceu." />
      {error ? <ErrorMessage>Não foi possível carregar suas caronas.</ErrorMessage> : null}
      {!error && rides.length === 0 ? (
        <EmptyState
          title="Você ainda não ofereceu carona."
          action={
            <AppButton href="/oferecer" variant="oferecer">
              OFERECER CARONA
            </AppButton>
          }
        />
      ) : null}
      <div className="space-y-4">
        {rides.map((r) => (
          <RideItem key={r.ride_id} ride={r} />
        ))}
      </div>
      <AutoRefresh active={live} />
    </>
  );
}
