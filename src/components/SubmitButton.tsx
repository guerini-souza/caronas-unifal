"use client";

import { useFormStatus } from "react-dom";
import { buttonClasses } from "@/components/AppButton";

type Props = {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: Parameters<typeof buttonClasses>[0];
};

export function SubmitButton({ children, pendingLabel = "Aguarde...", variant = "pegar" }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={buttonClasses(variant, "lg")}>
      {pending ? pendingLabel : children}
    </button>
  );
}
