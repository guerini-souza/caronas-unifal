"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCar, IconHome, IconList, IconUser } from "@/components/icons";

const ITEMS = [
  { href: "/inicio", label: "Início", Icon: IconHome },
  { href: "/reservas", label: "Reservas", Icon: IconList },
  { href: "/minhas-caronas", label: "Minhas caronas", Icon: IconCar },
  { href: "/perfil", label: "Perfil", Icon: IconUser },
];

export function BottomNavigation() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                prefetch={true}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs font-semibold ${
                  active ? "text-pegar" : "text-muted"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-center leading-tight">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
