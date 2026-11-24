import { notFound, redirect } from "next/navigation";
import { AppButton } from "@/components/AppButton";
import { PickupPointCard } from "@/components/PickupPointCard";
import { RideCard } from "@/components/RideCard";
import { EmptyState } from "@/components/States";
import { StepHeader } from "@/components/StepHeader";
import { requireProfile } from "@/lib/auth";
import { directionLabel, pointVerb } from "@/lib/direction";
import { formatDateTime, isPast } from "@/lib/format";
import { UUID_RE } from "@/lib/queries";
import { safeNext } from "@/lib/safe-next";
import type { RideSummary } from "@/lib/types";
import { ReserveButton } from "./ReserveButton";

export const dynamic = "force-dynamic";

export default async function CaronaResumoPage(props: PageProps<"/pegar/carona/[rideId]">) {
  const { rideId } = await props.params;
  const sp = await props.searchParams;
  const pontoId = typeof sp.ponto === "string" ? sp.ponto : "";
  if (!UUID_RE.test(rideId) || (pontoId && !UUID_RE.test(pontoId))) notFound();

  // Volta para a lista de onde veio (validado: só caminhos internos do fluxo /pegar).
  const voltar = safeNext(sp.voltar, "/pegar");
  const backHref = voltar.startsWith("/pegar") ? voltar : "/pegar";

  const { supabase } = await requireProfile(`/pegar/carona/${rideId}`);
  const { data } = await supabase.rpc("get_ride_summary", { p_ride_id: rideId }).maybeSingle<RideSummary>();
  if (!data) notFound();
  const point = pontoId ? data.points.find((p) => p.id === pontoId) : undefined;
  if (pontoId && !point) notFound();

  const unavailable = data.status !== "OPEN" || data.available_seats <= 0 || isPast(data.departure_at);
  const pointHref = (id: string) => `/pegar/carona/${data.ride_id}?ponto=${id}&voltar=${encodeURIComponent(backHref)}`;

  // Veio pelo link compartilhado: primeiro escolhe o ponto (se só há um, já segue com ele).
  if (!point && !data.is_driver && !data.already_reserved && !unavailable) {
    if (data.points.length === 1) redirect(pointHref(data.points[0].id));
    return (
      <>
        <StepHeader
          title={pointVerb(data.direction).question}
          subtitle={`${directionLabel(data.direction)} · ${formatDateTime(data.departure_at)}`}
          accent="pegar"
          backHref={backHref}
        />
        <div className="space-y-3">
          {data.points.map((p) => (
            <PickupPointCard key={p.id} name={p.name} href={pointHref(p.id)} accent="pegar" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <StepHeader
        title="Confirme sua carona"
        subtitle={
          point
            ? `${directionLabel(data.direction)} · você vai ${pointVerb(data.direction).action} ${point.name}`
            : directionLabel(data.direction)
        }
        accent="pegar"
        backHref={backHref}
      />
      <RideCard ride={data} highlightPointId={point?.id} />
      <p className="mt-4 rounded-2xl bg-pegar-soft px-4 py-3 text-base text-pegar-dark">
        O pagamento é combinado direto com o motorista.
      </p>
      <div className="mt-8">
        {data.is_driver ? (
          <EmptyState title="Essa carona é sua." />
        ) : data.already_reserved ? (
          <EmptyState
            title="Você já reservou essa carona."
            action={
              <AppButton href="/reservas" variant="pegar">
                VER MINHAS RESERVAS
              </AppButton>
            }
          />
        ) : unavailable || !point ? (
          <EmptyState
            title="Essa carona não está mais disponível."
            action={
              <AppButton href={backHref} variant="ghost">
                VER OUTRAS CARONAS
              </AppButton>
            }
          />
        ) : (
          <ReserveButton rideId={data.ride_id} pointId={point.id} direction={data.direction} />
        )}
      </div>
    </>
  );
}
