import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-6 text-center">
      <p className="text-lg font-bold">{title}</p>
      {description ? <p className="mt-2 text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted" role="status" aria-live="polite">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-pegar" aria-hidden />
      <span className="font-medium">{label}</span>
    </div>
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger">
      {children}
    </p>
  );
}

export function SuccessMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="status" className="rounded-xl bg-success-soft px-4 py-3 font-semibold text-success">
      {children}
    </p>
  );
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-success-soft text-success",
  FULL: "bg-oferecer-soft text-oferecer-dark",
  CANCELLED: "bg-danger-soft text-danger",
  COMPLETED: "bg-border text-muted",
  ACTIVE: "bg-success-soft text-success",
  CANCELLED_BY_PASSENGER: "bg-danger-soft text-danger",
  CANCELLED_BY_DRIVER: "bg-danger-soft text-danger",
  DEPARTED: "bg-border text-muted",
};
const STATUS_LABEL: Record<string, string> = {
  OPEN: "Aberta",
  FULL: "Lotada",
  CANCELLED: "Cancelada",
  COMPLETED: "Concluída",
  ACTIVE: "Confirmada",
  CANCELLED_BY_PASSENGER: "Cancelada por você",
  CANCELLED_BY_DRIVER: "Cancelada pelo motorista",
  DEPARTED: "Já saiu",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${STATUS_STYLE[status] ?? "bg-border"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
