"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { Field } from "@/components/Field";
import { ErrorMessage } from "@/components/States";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" required />
      <Field label="Senha" name="password" type="password" autoComplete="current-password" required />
      <ErrorMessage>{state?.error}</ErrorMessage>
      <SubmitButton pendingLabel="Entrando...">ENTRAR</SubmitButton>
    </form>
  );
}
