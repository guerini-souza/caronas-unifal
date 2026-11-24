import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "pegar" | "oferecer" | "pontos" | "whatsapp" | "danger" | "neutral" | "ghost";
type Size = "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  pegar: "bg-pegar text-white hover:bg-pegar-dark",
  oferecer: "bg-oferecer text-white hover:bg-oferecer-dark",
  pontos: "bg-pontos text-white hover:bg-pontos-dark",
  whatsapp: "bg-whatsapp text-white hover:bg-whatsapp-dark",
  danger: "bg-danger text-white hover:opacity-90",
  neutral: "bg-foreground text-white hover:opacity-90",
  ghost: "bg-surface text-foreground border-2 border-border hover:bg-background",
};

const SIZES: Record<Size, string> = {
  md: "min-h-12 px-4 text-base",
  lg: "min-h-14 px-5 text-lg",
  xl: "min-h-24 px-6 text-xl",
};

export function buttonClasses(variant: Variant = "pegar", size: Size = "lg", extra = "") {
  return [
    "inline-flex w-full items-center justify-center gap-3 rounded-2xl font-bold tracking-wide",
    "transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    extra,
  ].join(" ");
}

type Common = { variant?: Variant; size?: Size; icon?: ReactNode; children: ReactNode; className?: string };

type AsButton = Common & Omit<ComponentProps<"button">, "className" | "children"> & { href?: undefined };
type AsLink = Common & { href: string; external?: boolean };

export function AppButton(props: AsButton | AsLink) {
  const { variant, size, icon, children, className } = props;
  const cls = buttonClasses(variant, size, className);
  const content = (
    <>
      {icon}
      <span>{children}</span>
    </>
  );

  if ("href" in props && props.href !== undefined) {
    if (props.external) {
      return (
        <a href={props.href} target="_blank" rel="noopener noreferrer" className={cls}>
          {content}
        </a>
      );
    }
    return (
      <Link href={props.href} className={cls}>
        {content}
      </Link>
    );
  }

  const { variant: _v, size: _s, icon: _i, children: _c, className: _cn, ...rest } = props as AsButton;
  void _v; void _s; void _i; void _c; void _cn;
  return (
    <button type="button" {...rest} className={cls}>
      {content}
    </button>
  );
}
