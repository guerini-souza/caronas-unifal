import Link from "next/link";
import { IconPin } from "@/components/icons";

type Props = {
  name: string;
  href?: string;
  pending?: boolean;
  accent?: "pegar" | "oferecer" | "pontos";
  selected?: boolean;
  onClick?: () => void;
};

const ACCENT = {
  pegar: { icon: "text-pegar", border: "border-pegar", bg: "bg-pegar-soft", solid: "bg-pegar" },
  oferecer: { icon: "text-oferecer", border: "border-oferecer", bg: "bg-oferecer-soft", solid: "bg-oferecer" },
  pontos: { icon: "text-pontos", border: "border-pontos", bg: "bg-pontos-soft", solid: "bg-pontos" },
};

/** Card grande de ponto de carona (link, botão ou item selecionável). */
export function PickupPointCard({ name, href, pending, accent = "pegar", selected, onClick }: Props) {
  const a = ACCENT[accent];
  const cls = [
    "flex min-h-16 w-full items-center gap-4 rounded-2xl border-2 bg-surface px-4 py-3 text-left transition active:scale-[0.99]",
    selected ? `${a.border} ${a.bg}` : "border-border hover:border-muted",
  ].join(" ");
  const inner = (
    <>
      <IconPin className={`h-7 w-7 shrink-0 ${a.icon}`} />
      <span className="flex-1">
        <span className="block text-lg font-bold">{name}</span>
        {pending ? <span className="block text-sm text-muted">Informação aguardando cadastro</span> : null}
      </span>
      {onClick !== undefined ? (
        <span
          aria-hidden
          className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 text-white ${
            selected ? `${a.border} ${a.solid}` : "border-border"
          }`}
        >
          {selected ? "✓" : ""}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} prefetch={true} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} aria-pressed={onClick ? Boolean(selected) : undefined}>
      {inner}
    </button>
  );
}
