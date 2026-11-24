import { notFound } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";
import { requireAdmin } from "@/lib/admin";
import { UUID_RE } from "@/lib/queries";
import type { AdminPoint } from "@/lib/types";
import { PointForm } from "../PointForm";

export default async function EditarPontoPage(props: PageProps<"/admin/ponto/[pontoId]">) {
  const { pontoId } = await props.params;
  if (!UUID_RE.test(pontoId)) notFound();
  const { supabase } = await requireAdmin();
  const { data: point } = await supabase
    .from("pickup_points")
    .select("id, neighborhood_id, name, address, latitude, longitude, image_url, description, data_status, display_order, active")
    .eq("id", pontoId)
    .maybeSingle<AdminPoint>();
  if (!point) notFound();

  return (
    <>
      <StepHeader title="Editar ponto" subtitle={point.name} backHref={`/admin/bairro/${point.neighborhood_id}`} accent="pontos" />
      <PointForm key={point.id} neighborhoodId={point.neighborhood_id} point={point} />
    </>
  );
}
