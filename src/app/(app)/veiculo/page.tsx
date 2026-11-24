import type { Metadata } from "next";
import { StepHeader } from "@/components/StepHeader";
import { requireProfile } from "@/lib/auth";
import type { Vehicle } from "@/lib/types";
import { VehicleForm } from "./VehicleForm";

export const metadata: Metadata = { title: "Veículo" };

export default async function VeiculoPage(props: PageProps<"/veiculo">) {
  const sp = await props.searchParams;
  const next = sp.next === "/oferecer" ? "/oferecer" : "/perfil";
  const { supabase, user } = await requireProfile();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, model, color, plate, active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle<Vehicle>();

  return (
    <>
      <StepHeader
        title={vehicle ? "Editar veículo" : "Seu veículo"}
        subtitle={vehicle ? undefined : "Cadastre uma vez e use sempre."}
        backHref={next === "/oferecer" ? "/inicio" : "/perfil"}
        accent="oferecer"
      />
      <VehicleForm
        next={next}
        defaults={{ model: vehicle?.model ?? "", color: vehicle?.color ?? "", plate: vehicle?.plate ?? "" }}
      />
    </>
  );
}
