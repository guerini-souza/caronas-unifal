"use client";

import { useEffect, useRef } from "react";
import { AppButton } from "@/components/AppButton";

type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "danger" | "pegar" | "oferecer";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Modal de confirmação acessível (dialog nativo: foco preso e Esc fecha). */
export function ConfirmationModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Voltar",
  variant = "danger",
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-surface p-6 text-foreground shadow-2xl backdrop:bg-black/50"
      aria-labelledby="confirm-title"
    >
      <h2 id="confirm-title" className="break-words text-xl font-extrabold">
        {title}
      </h2>
      {message ? <p className="mt-2 text-muted">{message}</p> : null}
      <div className="mt-6 space-y-3">
        <AppButton variant={variant} onClick={onConfirm} disabled={busy}>
          {busy ? "Aguarde..." : confirmLabel}
        </AppButton>
        <AppButton variant="ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </AppButton>
      </div>
    </dialog>
  );
}
