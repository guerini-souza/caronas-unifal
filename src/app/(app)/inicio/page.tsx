import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import areaDosBixos from "@/assets/area-dos-bixos.webp";
import oferecerCarona from "@/assets/oferecer-carona.webp";
import pegarCarona from "@/assets/pegar-carona.webp";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Início" };

// As imagens já trazem o texto do botão; o rótulo acessível fica no aria-label.
const ACTIONS: { href: string; label: string; image: StaticImageData; ring: string }[] = [
  { href: "/pegar", label: "Pegar carona", image: pegarCarona, ring: "focus-visible:ring-pegar" },
  { href: "/oferecer", label: "Oferecer carona", image: oferecerCarona, ring: "focus-visible:ring-oferecer" },
  { href: "/pontos", label: "Pontos para bixetes: conheça os principais pontos de Poços de Caldas", image: areaDosBixos, ring: "focus-visible:ring-pontos" },
];

export default async function InicioPage() {
  const { profile } = await requireProfile();
  const firstName = profile.name.split(" ")[0];

  return (
    <>
      <h1 className="mb-5 mt-4 text-2xl font-extrabold">Olá, {firstName}!</h1>
      <div className="mb-5">
        <NotificationPrompt context="inicio" />
      </div>
      <div className="space-y-4">
        {ACTIONS.map(({ href, label, image, ring }, i) => (
          <Link
            key={href}
            href={href}
            prefetch={true}
            aria-label={label}
            className={`block overflow-hidden rounded-3xl bg-surface shadow-md ring-1 ring-border transition active:scale-[0.98] focus-visible:ring-4 ${ring}`}
          >
            <Image
              src={image}
              alt=""
              placeholder="blur"
              priority={i < 2}
              sizes="(max-width: 448px) 100vw, 448px"
              className="h-auto w-full"
            />
          </Link>
        ))}
      </div>
    </>
  );
}
