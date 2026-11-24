import type { Metadata } from "next";
import { AppButton } from "@/components/AppButton";
import { StepHeader } from "@/components/StepHeader";
import { safeNext } from "@/lib/safe-next";
import { ResendForm } from "./ResendForm";

export const metadata: Metadata = { title: "Confirme seu e-mail" };

export default async function VerifyEmailPage(props: PageProps<"/verificar-email">) {
  const sp = await props.searchParams;
  // Veio de um link de carona: o novo e-mail e o "já confirmei" também voltam para ela.
  const next = safeNext(sp.next, "");
  return (
    <main className="px-5 pb-10 pt-4">
      <StepHeader title="Confirme seu e-mail" backHref="/" />
      <div className="space-y-4 text-lg">
        <p>Enviamos um link para o seu e-mail.</p>
        <p>Abra o e-mail e toque no link para liberar o app. Olhe também a caixa de spam.</p>
      </div>
      <div className="mt-8 space-y-3">
        <AppButton href={next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar"} variant="pegar">
          JÁ CONFIRMEI, ENTRAR
        </AppButton>
      </div>
      <div className="mt-10 border-t border-border pt-6">
        <p className="mb-3 font-bold">Não recebeu?</p>
        <ResendForm next={next} />
      </div>
    </main>
  );
}
