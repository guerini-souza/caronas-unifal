"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/actions/auth";
import { Field } from "@/components/Field";
import { ErrorMessage } from "@/components/States";
import { SubmitButton } from "@/components/SubmitButton";

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      <Field
        label="Nova senha"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        hint="Pelo menos 8 caracteres."
        required
      />
      <Field label="Repita a nova senha" name="confirm" type="password" autoComplete="new-password" required />
      <ErrorMessage>{state?.error}</ErrorMessage>
      <SubmitButton pendingLabel="Salvando...">SALVAR NOVA SENHA</SubmitButton>
    </form>
  );
}
