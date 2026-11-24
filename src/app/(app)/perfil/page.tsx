import type { Metadata } from "next";
import { AppButton } from "@/components/AppButton";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { StepHeader } from "@/components/StepHeader";
import { VehicleCard } from "@/components/VehicleCard";
import { isAdmin } from "@/lib/admin";
import { type Profile, requireUser } from "@/lib/auth";
import { formatPhone } from "@/lib/format";
import { getNeighborhoods } from "@/lib/queries";
import { safeNext } from "@/lib/safe-next";
import type { Vehicle } from "@/lib/types";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Perfil" };

export default async function PerfilPage(props: PageProps<"/perfil">) {
  const sp = await props.searchParams;
  const next = safeNext(sp.next);

  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: neighborhoods }, { data: vehicle }, admin] = await Promise.all([
    supabase.from("profiles").select("id, user_id, name, phone, email, neighborhood_id").eq("user_id", user.id).maybeSingle<Profile>(),
    getNeighborhoods(supabase),
    supabase.from("vehicles").select("id, model, color, plate, active").eq("user_id", user.id).eq("active", true).maybeSingle<Vehicle>(),
    isAdmin(supabase),
  ]);

  return (
    <>
      <StepHeader
        title={profile ? "Seu perfil" : "Primeiro acesso"}
        subtitle={profile ? undefined : "Só 3 informações e pronto."}
      />
      <ProfileForm
        email={user.email ?? ""}
        neighborhoods={neighborhoods}
        next={next}
        defaults={{
          name: profile?.name ?? "",
          phone: profile ? formatPhone(profile.phone) : "",
          // Bairro atual oculto pelo admin: obriga escolher de novo em vez de trocar sem avisar.
          neighborhood_id: profile
            ? neighborhoods.some((n) => n.id === profile.neighborhood_id)
              ? (profile.neighborhood_id ?? "")
              : ""
            : neighborhoods.length === 1
              ? neighborhoods[0].id
              : "",
        }}
        submitLabel={profile ? "SALVAR" : "CONTINUAR"}
      />

      {profile ? (
        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-extrabold">Seu veículo</h2>
          {vehicle ? (
            <VehicleCard vehicle={vehicle} editHref="/veiculo" />
          ) : (
            <AppButton href="/veiculo" variant="ghost">
              CADASTRAR VEÍCULO
            </AppButton>
          )}
        </section>
      ) : null}

      {admin ? (
        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-extrabold">Conta oficial</h2>
          <AppButton href="/admin" variant="pontos">
            PAINEL ADMIN
          </AppButton>
        </section>
      ) : null}

      {profile ? (
        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-extrabold">Notificações</h2>
          <NotificationPrompt context="perfil" />
        </section>
      ) : null}

      <div className="mt-10">
        <LogoutButton />
      </div>
    </>
  );
}
