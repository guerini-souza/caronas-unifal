"use client";

import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import { Field } from "@/components/Field";
import { ErrorMessage } from "@/components/States";
import { SubmitButton } from "@/components/SubmitButton";

export function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUp, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" required />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        hint="Pelo menos 8 caracteres."
        required
      />
      <Field label="Repita a senha" name="confirm" type="password" autoComplete="new-password" required />
      <ErrorMessage>{state?.error}</ErrorMessage>
      <SubmitButton pendingLabel="Criando...">CRIAR CONTA</SubmitButton>
    </form>
  );
}
