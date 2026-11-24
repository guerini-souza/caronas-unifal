"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { Field } from "@/components/Field";
import { ErrorMessage, SuccessMessage } from "@/components/States";
import { SubmitButton } from "@/components/SubmitButton";

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      <Field label="Seu e-mail" name="email" type="email" autoComplete="email" inputMode="email" required />
      <ErrorMessage>{state?.error}</ErrorMessage>
      <SuccessMessage>{state?.message}</SuccessMessage>
      <SubmitButton pendingLabel="Enviando...">ENVIAR LINK</SubmitButton>
    </form>
  );
}
