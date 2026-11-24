import type { Metadata } from "next";
import Link from "next/link";
import { StepHeader } from "@/components/StepHeader";
import { safeNext } from "@/lib/safe-next";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage(props: PageProps<"/cadastro">) {
  const sp = await props.searchParams;
  // Veio de um link de carona: depois de confirmar o e-mail, volta para ela.
  const next = safeNext(sp.next, "");
  return (
    <main className="px-5 pb-10 pt-4">
      <StepHeader title="Criar conta" subtitle="Você vai receber um e-mail para confirmar." backHref="/" />
      <SignUpForm next={next} />
      <p className="mt-8 text-center text-base">
        Já tem conta?{" "}
        <Link href={next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar"} className="font-bold text-pegar underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </main>
  );
}
