"use client";

import { useActionState } from "react";
import { resendVerification } from "@/app/actions/auth";
import { Field } from "@/components/Field";
import { ErrorMessage, SuccessMessage } from "@/components/States";
import { SubmitButton } from "@/components/SubmitButton";

export function ResendForm({ next }: { next: string }) {
  const [state, action] = useActionState(resendVerification, undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="Seu e-mail" name="email" type="email" autoComplete="email" inputMode="email" required />
      <ErrorMessage>{state?.error}</ErrorMessage>
      <SuccessMessage>{state?.message}</SuccessMessage>
      <SubmitButton variant="ghost" pendingLabel="Enviando...">
        REENVIAR LINK
      </SubmitButton>
    </form>
  );
}
