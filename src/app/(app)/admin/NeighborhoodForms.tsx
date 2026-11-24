"use client";

import { useActionState } from "react";
import { createNeighborhood, updateNeighborhood } from "@/app/actions/admin";
import { Field } from "@/components/Field";
import { ErrorMessage, SuccessMessage } from "@/components/States";
import { SubmitButton } from "@/components/SubmitButton";

export function CreateNeighborhoodForm() {
  const [state, action] = useActionState(createNeighborhood, undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Nome do bairro" name="name" placeholder="Ex.: Jardim Country Club" maxLength={80} required />
      <ErrorMessage>{state?.error}</ErrorMessage>
      <SubmitButton variant="pontos" pendingLabel="Criando...">
        CRIAR BAIRRO
      </SubmitButton>
    </form>
  );
}

export function EditNeighborhoodForm({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [state, action] = useActionState(updateNeighborhood, undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <Field label="Nome do bairro" name="name" defaultValue={name} maxLength={80} required />
      <label className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-border bg-surface px-4">
        <input type="checkbox" name="active" defaultChecked={active} className="h-6 w-6 accent-pontos" />
        <span className="text-lg font-semibold">Mostrar este bairro no app</span>
      </label>
      <ErrorMessage>{state?.error}</ErrorMessage>
      <SuccessMessage>{state?.message}</SuccessMessage>
      <SubmitButton variant="ghost" pendingLabel="Salvando...">
        SALVAR BAIRRO
      </SubmitButton>
    </form>
  );
}
