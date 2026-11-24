import Link from "next/link";
import { IconPin } from "@/components/icons";
import { EmptyState } from "@/components/States";
import { StepHeader } from "@/components/StepHeader";
import { requireAdmin } from "@/lib/admin";
import { CreateNeighborhoodForm } from "./NeighborhoodForms";

// Sem título próprio: quem não é admin recebe "não encontrada" e a aba não revela o painel.
export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const [{ data: neighborhoods }, { data: points }] = await Promise.all([
    supabase.from("neighborhoods").select("id, name, active").order("name"),
    supabase.from("pickup_points").select("neighborhood_id, data_status, active"),
  ]);

  return (
    <>
      <StepHeader title="Painel admin" subtitle="Bairros e pontos mostrados aos bixetes." backHref="/perfil" accent="pontos" />

      {(neighborhoods ?? []).length === 0 ? <EmptyState title="Nenhum bairro ainda." /> : null}
      <ul className="space-y-3">
        {(neighborhoods ?? []).map((n) => {
          const active = (points ?? []).filter((p) => p.neighborhood_id === n.id && p.active);
          const pending = active.filter((p) => p.data_status === "pending_data").length;
          return (
            <li key={n.id}>
              <Link
                href={`/admin/bairro/${n.id}`}
                className="flex min-h-16 items-center gap-4 rounded-2xl border-2 border-border bg-surface px-4 py-3 hover:border-muted"
              >
                <IconPin className="h-7 w-7 shrink-0 text-pontos" />
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold">{n.name}</span>
                  <span className="block text-sm text-muted">
                    {active.length} {active.length === 1 ? "ponto" : "pontos"}
                    {pending ? ` · ${pending} sem endereço ou foto` : ""}
                  </span>
                </span>
                {!n.active ? (
                  <span className="rounded-full bg-border px-3 py-1 text-sm font-bold text-muted">Oculto</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-extrabold">Novo bairro</h2>
        <CreateNeighborhoodForm />
      </section>
    </>
  );
}
