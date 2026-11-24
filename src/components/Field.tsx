import type { ComponentProps } from "react";

type Props = ComponentProps<"input"> & { label: string; error?: string; hint?: string };

/** Campo de formulário grande, com rótulo e erro acessíveis. */
export function Field({ label, error, hint, id, name, className, ...rest }: Props) {
  const inputId = id ?? name;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-base font-bold">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`block min-h-14 w-full rounded-2xl border-2 bg-surface px-4 text-lg outline-none transition focus:border-pegar ${
          error ? "border-danger" : "border-border"
        } ${className ?? ""}`}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
