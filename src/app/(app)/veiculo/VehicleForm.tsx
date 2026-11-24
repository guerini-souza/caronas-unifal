"use client";

import { useActionState } from "react";
import { saveVehicle } from "@/app/actions/profile";
import { Field } from "@/components/Field";
import { ErrorMessage } from "@/components/States";
import { SubmitButton } from "@/components/SubmitButton";

type Props = { next: string; defaults: { model: string; color: string; plate: string } };

export function VehicleForm({ next, defaults }: Props) {
  const [state, action] = useActionState(saveVehicle, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="Modelo" name="model" placeholder="Ex.: Onix" defaultValue={defaults.model} error={fe.model} required />
      <Field label="Cor" name="color" placeholder="Ex.: Prata" defaultValue={defaults.color} error={fe.color} required />
      <Field
        label="Placa"
        name="plate"
        placeholder="ABC1D23"
        autoCapitalize="characters"
        defaultValue={defaults.plate}
        hint="Os passageiros só veem parte da placa."
        error={fe.plate}
        className="font-mono uppercase tracking-widest"
        maxLength={8}
        required
      />
      <ErrorMessage>{state?.error}</ErrorMessage>
      <SubmitButton variant="oferecer" pendingLabel="Salvando...">
        SALVAR VEÍCULO
      </SubmitButton>
    </form>
  );
}
