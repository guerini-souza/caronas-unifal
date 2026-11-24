"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions/auth";
import { removePushSubscription } from "@/app/actions/push";
import { buttonClasses } from "@/components/AppButton";
import { currentSubscription } from "@/lib/push/client";

/** Sair: antes, este celular deixa de receber os avisos da conta (outra pessoa pode usar o aparelho). */
export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  function logout() {
    startTransition(async () => {
      try {
        const subscription = await currentSubscription();
        if (subscription) {
          await removePushSubscription(subscription.endpoint);
          await subscription.unsubscribe();
        }
        localStorage.removeItem("caronas.push-sync");
      } catch {}
      await signOut();
    });
  }

  return (
    <button type="button" onClick={logout} disabled={pending} aria-busy={pending} className={buttonClasses("ghost", "md")}>
      {pending ? "Saindo..." : "Sair"}
    </button>
  );
}
