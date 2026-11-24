import Link from "next/link";
import { notFound } from "next/navigation";
import { movePoint } from "@/app/actions/admin";
import { AppButton } from "@/components/AppButton";
import { EmptyState, SuccessMessage } from "@/components/States";
import { StepHeader } from "@/components/StepHeader";
import { requireAdmin } from "@/lib/admin";
import { UUID_RE } from "@/lib/queries";
import { EditNeighborhoodForm } from "../../NeighborhoodForms";

const moveCls =
  "flex h-12 w-12 items-center justify-center rounded-xl border-2 border-border bg-surface text-xl font-bold disabled:opacity-30";

export default async function AdminBairroPage(props: PageProps<"/admin/bairro/[bairroId]">) {
  const { bairroId } = await props.params;
  const sp = await props.searchParams;
  if (!UUID_RE.test(bairroId)) notFound();
  const { supabase } = await requireAdmin();
  const [{ data: neighborhood }, { data: points }] = await Promise.all([
    supabase.from("neighborhoods").select("id, name, active").eq("id", bairroId).maybeSingle(),
    supabase
      .from("pickup_points")
      .select("id, name, data_status, active")
      .eq("neighborhood_id", bairroId)
      .order("display_order")
      .order("name"),
  ]);
  if (!neighborhood) notFound();
  const list = points ?? [];

  return (
    <>
      <StepHeader title={neighborhood.name} subtitle="Toque num ponto para editar." backHref="/admin" accent="pontos" />
      {sp.salvo === "1" ? (
        <div className="mb-4">
          <SuccessMessage>Ponto salvo.</SuccessMessage>
        </div>
      ) : null}

      {list.length === 0 ? <EmptyState title="Nenhum ponto neste bairro ainda." /> : null}
      <ol className="space-y-3">
        {list.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2">
            <Link
              href={`/admin/ponto/${p.id}`}
              className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl border-2 border-border bg-surface px-4 py-3 hover:border-muted"
            >
              <span className="w-6 shrink-0 text-center text-lg font-extrabold text-pontos">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-bold">{p.name}</span>
                <span className={`block text-sm ${!p.active ? "text-muted" : p.data_status === "complete" ? "text-success" : "text-oferecer-dark"}`}>
                  {!p.active ? "Oculto" : p.data_status === "complete" ? "Completo" : "Falta endereço ou foto"}
                </span>
              </span>
            </Link>
            <form action={movePoint}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="dir" value="up" />
              <button type="submit" className={moveCls} disabled={i === 0} aria-label={`Subir ${p.name}`}>
                ↑
              </button>
            </form>
            <form action={movePoint}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="dir" value="down" />
              <button type="submit" className={moveCls} disabled={i === list.length - 1} aria-label={`Descer ${p.name}`}>
                ↓
              </button>
            </form>
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-3">
        <AppButton href={`/admin/ponto/novo?bairro=${neighborhood.id}`} variant="pontos">
          NOVO PONTO
        </AppButton>
        {neighborhood.active ? (
          <AppButton href={`/pontos/${neighborhood.id}`} variant="ghost">
            VER COMO OS ALUNOS VEEM
          </AppButton>
        ) : null}
      </div>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-extrabold">Dados do bairro</h2>
        <EditNeighborhoodForm id={neighborhood.id} name={neighborhood.name} active={neighborhood.active} />
      </section>
    </>
  );
}
