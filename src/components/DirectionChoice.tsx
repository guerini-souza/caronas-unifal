import Link from "next/link";
import type { RideDirection } from "@/lib/direction";

type Option = { direction: RideDirection; title: string; hint: string; arrow: string };

const OPTIONS: Option[] = [
  { direction: "TO_CAMPUS", title: "IDA", hint: "Do bairro para a UNIFAL", arrow: "→" },
  { direction: "FROM_CAMPUS", title: "VOLTA", hint: "Da UNIFAL para o bairro", arrow: "←" },
];

type Props = {
  accent: "pegar" | "oferecer";
  selected?: RideDirection | null;
  /** Modo link (passageiro: cada escolha é uma URL). */
  hrefFor?: (d: RideDirection) => string;
  /** Modo botão (motorista: wizard em memória). */
  onSelect?: (d: RideDirection) => void;
};

const ACCENT = {
  pegar: { on: "border-pegar bg-pegar text-white", off: "border-border bg-surface text-foreground hover:border-pegar" },
  oferecer: { on: "border-oferecer bg-oferecer text-white", off: "border-border bg-surface text-foreground hover:border-oferecer" },
};

/** Primeira decisão dos dois fluxos: IDA ou VOLTA. Botões grandes, um por linha. */
export function DirectionChoice({ accent, selected, hrefFor, onSelect }: Props) {
  return (
    <div className="space-y-4">
      {OPTIONS.map((o) => {
        const active = selected === o.direction;
        const cls = `flex min-h-28 w-full items-center gap-5 rounded-3xl border-2 px-6 py-5 text-left transition active:scale-[0.98] ${
          active ? ACCENT[accent].on : ACCENT[accent].off
        }`;
        const inner = (
          <>
            <span aria-hidden className="text-5xl font-black leading-none">
              {o.arrow}
            </span>
            <span>
              <span className="block text-2xl font-extrabold">{o.title}</span>
              <span className={`block text-base ${active ? "text-white/90" : "text-muted"}`}>{o.hint}</span>
            </span>
          </>
        );
        return hrefFor ? (
          <Link key={o.direction} href={hrefFor(o.direction)} className={cls}>
            {inner}
          </Link>
        ) : (
          <button key={o.direction} type="button" className={cls} aria-pressed={active} onClick={() => onSelect?.(o.direction)}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}
