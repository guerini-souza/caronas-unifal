"use client";

import { useState } from "react";
import { AppButton } from "@/components/AppButton";
import { IconWhatsapp } from "@/components/icons";
import { SITE_URL } from "@/lib/env";
import { rideSharePath } from "@/lib/share";
import { type ShareableRide, rideShareMessage, whatsappShareUrl } from "@/lib/whatsapp";

/** COMPARTILHAR NO WHATSAPP (escolhe contato ou grupo) + Copiar link. */
export function ShareRideButtons({ rideId, ride }: { rideId: string; ride: ShareableRide }) {
  const [copied, setCopied] = useState(false);
  const link = `${SITE_URL}${rideSharePath(rideId)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copie o link da carona:", link);
    }
  }

  return (
    <div className="grid gap-3">
      <AppButton href={whatsappShareUrl(rideShareMessage(ride, link))} external variant="whatsapp" icon={<IconWhatsapp />}>
        COMPARTILHAR NO WHATSAPP
      </AppButton>
      <AppButton variant="ghost" size="md" onClick={copy}>
        {copied ? "Link copiado ✓" : "Copiar link"}
      </AppButton>
    </div>
  );
}
