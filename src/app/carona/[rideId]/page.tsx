import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { AppButton } from "@/components/AppButton";
import { IconPin } from "@/components/icons";
import { EmptyState } from "@/components/States";
import { directionLabel, routeText } from "@/lib/direction";
import { formatDateTime, formatPrice, isPast } from "@/lib/format";
import { UUID_RE } from "@/lib/queries";
import { rideSharePath } from "@/lib/share";
import { createClient } from "@/lib/supabase/server";
import type { RidePreview } from "@/lib/types";

// Mesmo resultado para os metadados (cartão do WhatsApp) e para a página.
const getPreview = cache(async (rideId: string) => {
  if (!UUID_RE.test(rideId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_ride_preview", { p_ride_id: rideId }).maybeSingle<RidePreview>();
  return data ?? null;
});

function isAvailable(p: RidePreview) {
  return p.status === "OPEN" && p.available_seats > 0 && !isPast(p.departure_at);
}

function seatsText(n: number) {
  return n === 1 ? "1 vaga" : `${n} vagas`;
}

export async function generateMetadata(props: PageProps<"/carona/[rideId]">): Promise<Metadata> {
  const { rideId } = await props.params;
  const p = await getPreview(rideId);
  if (!p) return { title: "Carona" };
  const title = `${directionLabel(p.direction)} · ${formatDateTime(p.departure_at)}`;
  const description = isAvailable(p)
    ? `${p.neighborhood_name} · ${formatPrice(p.price)} · ${seatsText(p.available_seats)}. Toque para reservar no Caronas UNIFAL.`
    : "Essa carona não está mais disponível. Veja outras no Caronas UNIFAL.";
  return {
    title,
    description,
    robots: { index: false },
    openGraph: {
      title,
      description,
      url: rideSharePath(p.ride_id),
      siteName: "Caronas UNIFAL",
      locale: "pt_BR",
      type: "website",
      images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "Caronas UNIFAL" }],
    },
  };
}

export default async function CaronaCompartilhadaPage(props: PageProps<"/carona/[rideId]">) {
  const { rideId } = await props.params;
  const p = await getPreview(rideId);
  if (!p) notFound();

  // Logado: vai direto para a carona (escolher o ponto e reservar; lá também aparece "já reservou",
  // "é sua" ou "lotada"). Carona cancelada/encerrada fica aqui, com a mensagem de indisponível.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub && (p.status === "OPEN" || p.status === "FULL")) {
    redirect(`/pegar/carona/${p.ride_id}?voltar=/pegar`);
  }

  const next = encodeURIComponent(rideSharePath(p.ride_id));
  return (
    <main className="px-5 pb-10 pt-6">
      <p className="text-sm font-bold uppercase tracking-wide text-pegar">Carona compartilhada</p>
      <h1 className="mt-1 text-2xl font-extrabold">{directionLabel(p.direction)}</h1>
      <p className="mt-1 text-xl font-bold">{formatDateTime(p.departure_at)}</p>
      <div className="mt-5 space-y-2 rounded-2xl border-2 border-border bg-surface p-4">
        <p className="flex items-start gap-2">
          <IconPin className="mt-0.5 h-5 w-5 shrink-0 text-pegar" />
          {routeText(p.direction, p.points)}
        </p>
        <p className="text-muted">
          {p.neighborhood_name} · {formatPrice(p.price)} · {seatsText(p.available_seats)}
        </p>
      </div>

      {isAvailable(p) ? (
        <>
          <div className="mt-8 space-y-3">
            <AppButton href={`/entrar?next=${next}`} variant="pegar">
              ENTRAR PARA RESERVAR
            </AppButton>
            <AppButton href={`/cadastro?next=${next}`} variant="ghost">
              CRIAR CONTA
            </AppButton>
          </div>
          <p className="mt-6 rounded-2xl bg-pegar-soft px-4 py-3 text-base text-pegar-dark">
            Depois de reservar, ative as notificações no app para saber quando o motorista sair.
          </p>
        </>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="Essa carona não está mais disponível."
            action={
              // /pegar é protegido: sem login, o app pede para entrar e volta para a busca.
              <AppButton href="/pegar" variant="pegar">
                VER OUTRAS CARONAS
              </AppButton>
            }
          />
        </div>
      )}
    </main>
  );
}
