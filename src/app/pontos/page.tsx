import type { Metadata } from "next";
import Image from "next/image";
import areaDosBixos from "@/assets/area-dos-bixos.webp";
import { PickupPointCard } from "@/components/PickupPointCard";
import { EmptyState, ErrorMessage } from "@/components/States";
import { StepHeader } from "@/components/StepHeader";
import { getNeighborhoods } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pontos para bixetes" };

export default async function PontosPage() {
  const supabase = await createClient();
  const { data: neighborhoods, error } = await getNeighborhoods(supabase);

  return (
    <main className="px-5 pb-10 pt-4">
      <StepHeader title="Pontos para bixetes" subtitle="Escolha o bairro." backHref="/" accent="pontos" />
      <Image
        src={areaDosBixos}
        alt="Área dos bixos: conheça os principais pontos de Poços de Caldas"
        placeholder="blur"
        priority
        sizes="(max-width: 448px) 100vw, 448px"
        className="mb-6 h-auto w-full rounded-3xl shadow-md"
      />
      {error ? <ErrorMessage>Não foi possível carregar os bairros.</ErrorMessage> : null}
      {!error && neighborhoods.length === 0 ? <EmptyState title="Nenhum bairro cadastrado ainda." /> : null}
      <div className="space-y-3">
        {neighborhoods.map((n) => (
          <PickupPointCard key={n.id} name={n.name} href={`/pontos/${n.id}`} accent="pontos" />
        ))}
      </div>
    </main>
  );
}
