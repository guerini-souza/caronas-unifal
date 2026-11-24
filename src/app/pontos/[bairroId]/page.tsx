import { notFound } from "next/navigation";
import { PickupPointCard } from "@/components/PickupPointCard";
import { EmptyState, ErrorMessage } from "@/components/States";
import { StepHeader } from "@/components/StepHeader";
import { UUID_RE, getNeighborhood, getPickupPoints } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function PontosBairroPage(props: PageProps<"/pontos/[bairroId]">) {
  const { bairroId } = await props.params;
  if (!UUID_RE.test(bairroId)) notFound();
  const supabase = await createClient();
  const neighborhood = await getNeighborhood(supabase, bairroId);
  if (!neighborhood) notFound();
  const { data: points, error } = await getPickupPoints(supabase, bairroId);

  return (
    <main className="px-5 pb-10 pt-4">
      <StepHeader title={neighborhood.name} subtitle="Escolha o ponto." backHref="/pontos" accent="pontos" />
      {error ? <ErrorMessage>Não foi possível carregar os pontos.</ErrorMessage> : null}
      {!error && points.length === 0 ? <EmptyState title="Nenhum ponto cadastrado neste bairro." /> : null}
      <div className="space-y-3">
        {points.map((p) => (
          <PickupPointCard
            key={p.id}
            name={p.name}
            href={`/pontos/ponto/${p.id}`}
            pending={p.data_status === "pending_data"}
            accent="pontos"
          />
        ))}
      </div>
    </main>
  );
}
