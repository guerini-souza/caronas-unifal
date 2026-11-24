import Link from "next/link";
import { IconBack } from "@/components/icons";

type Props = {
  title: string;
  subtitle?: string;
  step?: number;
  totalSteps?: number;
  backHref?: string;
  onBack?: () => void;
  accent?: "pegar" | "oferecer" | "pontos" | "neutral";
};

const ACCENT = {
  pegar: "bg-pegar",
  oferecer: "bg-oferecer",
  pontos: "bg-pontos",
  neutral: "bg-foreground",
};

/** Cabeçalho de tela/etapa: voltar, progresso e título curto. */
export function StepHeader({ title, subtitle, step, totalSteps, backHref, onBack, accent = "neutral" }: Props) {
  const backCls =
    "-ml-1 inline-flex h-12 w-12 items-center justify-center rounded-full text-foreground hover:bg-background";
  return (
    <header className="mb-6">
      <div className="flex min-h-12 items-center gap-2">
        {backHref ? (
          <Link href={backHref} className={backCls} aria-label="Voltar">
            <IconBack className="h-7 w-7" />
          </Link>
        ) : onBack ? (
          <button type="button" onClick={onBack} className={backCls} aria-label="Voltar">
            <IconBack className="h-7 w-7" />
          </button>
        ) : null}
        {step && totalSteps ? (
          <p className="text-sm font-semibold text-muted" aria-live="polite">
            Etapa {step} de {totalSteps}
          </p>
        ) : null}
      </div>
      {step && totalSteps ? (
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={step}
          aria-label="Progresso"
        >
          <div className={`h-full ${ACCENT[accent]} transition-all`} style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
      ) : null}
      <h1 className="mt-4 text-2xl font-extrabold leading-tight">{title}</h1>
      {subtitle ? <p className="mt-1 text-base text-muted">{subtitle}</p> : null}
    </header>
  );
}
