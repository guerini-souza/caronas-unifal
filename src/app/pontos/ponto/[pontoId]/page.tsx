/* eslint-disable @next/next/no-img-element -- foto já reduzida no envio e servida pelo Storage; evita a cota de otimização de imagens da Vercel. */
import { notFound } from "next/navigation";
import { IconPin } from "@/components/icons";
import { StepHeader } from "@/components/StepHeader";
import { UUID_RE, getPickupPoint } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

const PENDING = "Informação aguardando cadastro";

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="text-sm font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-lg ${value ? "" : "italic text-muted"}`}>{value || PENDING}</p>
    </div>
  );
}

export default async function PontoDetalhePage(props: PageProps<"/pontos/ponto/[pontoId]">) {
  const { pontoId } = await props.params;
  if (!UUID_RE.test(pontoId)) notFound();
  const supabase = await createClient();
  const point = await getPickupPoint(supabase, pontoId);
  if (!point) notFound();

  const hasCoords = point.latitude !== null && point.longitude !== null;
  const safeImage = point.image_url && /^https:\/\//.test(point.image_url) ? point.image_url : null;

  return (
    <main className="px-5 pb-10 pt-4">
      <StepHeader title={point.name} backHref={`/pontos/${point.neighborhood_id}`} accent="pontos" />

      <div className="mb-4 flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-pontos-soft">
        {safeImage ? (
          <img src={safeImage} alt={`Foto do ponto ${point.name}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-pontos-dark">
            <IconPin className="h-12 w-12" />
            <span className="font-semibold">Foto: {PENDING.toLowerCase()}</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Info label="Nome" value={point.name} />
        <Info label="Endereço" value={point.address} />
        <Info label="Observações" value={point.description} />
        <div className="rounded-2xl bg-surface p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-muted">Mapa</p>
          {hasCoords ? (
            <a
              className="mt-1 inline-block text-lg font-bold text-pontos underline underline-offset-4"
              href={`https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir no mapa
            </a>
          ) : (
            <p className="mt-1 text-lg italic text-muted">Em breve</p>
          )}
        </div>
      </div>
    </main>
  );
}
