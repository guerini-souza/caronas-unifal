"use client";

import { useActionState } from "react";
import { saveProfile } from "@/app/actions/profile";
import { Field } from "@/components/Field";
import { ErrorMessage } from "@/components/States";
import { SubmitButton } from "@/components/SubmitButton";
import type { Neighborhood } from "@/lib/types";

type Props = {
  email: string;
  neighborhoods: Neighborhood[];
  next: string;
  defaults: { name: string; phone: string; neighborhood_id: string };
  submitLabel: string;
};

export function ProfileForm({ email, neighborhoods, next, defaults, submitLabel }: Props) {
  const [state, action] = useActionState(saveProfile, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="Nome" name="name" autoComplete="name" defaultValue={defaults.name} error={fe.name} required />
      <Field
        label="WhatsApp"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(35) 99999-1234"
        defaultValue={defaults.phone}
        hint="Usado para os colegas falarem com você."
        error={fe.phone}
        required
      />
      <div className="space-y-2">
        <label htmlFor="neighborhood_id" className="block text-base font-bold">
          Bairro
        </label>
        <select
          id="neighborhood_id"
          name="neighborhood_id"
          defaultValue={defaults.neighborhood_id}
          aria-invalid={fe.neighborhood_id ? true : undefined}
          className={`block min-h-14 w-full rounded-2xl border-2 bg-surface px-4 text-lg outline-none focus:border-pegar ${
            fe.neighborhood_id ? "border-danger" : "border-border"
          }`}
          required
        >
          <option value="" disabled>
            Escolha...
          </option>
          {neighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
        {fe.neighborhood_id ? <p className="text-sm font-semibold text-danger">{fe.neighborhood_id}</p> : null}
      </div>
      <Field label="E-mail" name="email_display" value={email} readOnly disabled hint="E-mail do login." />
      <ErrorMessage>{state?.error}</ErrorMessage>
      <SubmitButton pendingLabel="Salvando...">{submitLabel}</SubmitButton>
    </form>
  );
}
