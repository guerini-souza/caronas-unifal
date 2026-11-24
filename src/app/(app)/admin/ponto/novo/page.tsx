import { notFound } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";
import { requireAdmin } from "@/lib/admin";
import { UUID_RE } from "@/lib/queries";
import { PointForm } from "../PointForm";

export default async function NovoPontoPage(props: PageProps<"/admin/ponto/novo">) {
  const { bairro } = await props.searchParams;
  if (typeof bairro !== "string" || !UUID_RE.test(bairro)) notFound();
  const { supabase } = await requireAdmin();
  const { data: neighborhood } = await supabase.from("neighborhoods").select("id, name").eq("id", bairro).maybeSingle();
  if (!neighborhood) notFound();

  return (
    <>
      <StepHeader title="Novo ponto" subtitle={neighborhood.name} backHref={`/admin/bairro/${neighborhood.id}`} accent="pontos" />
      <PointForm neighborhoodId={neighborhood.id} point={null} />
    </>
  );
}
