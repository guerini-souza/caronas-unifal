import type { Metadata } from "next";
import Link from "next/link";
import { StepHeader } from "@/components/StepHeader";
import { safeNext } from "@/lib/safe-next";
import { SuccessMessage } from "@/components/States";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage(props: PageProps<"/entrar">) {
  const sp = await props.searchParams;
  const next = safeNext(sp.next);
  const confirmed = sp.confirmado === "1";
  return (
    <main className="px-5 pb-10 pt-4">
      <StepHeader title="Entrar" backHref="/" />
      {confirmed ? (
        <div className="mb-4">
          <SuccessMessage>E-mail confirmado! Agora é só entrar.</SuccessMessage>
        </div>
      ) : null}
      <LoginForm next={next} />
      <p className="mt-6 text-center text-base">
        <Link href="/esqueci-senha" className="font-semibold text-pegar underline underline-offset-4">
          Esqueci minha senha
        </Link>
      </p>
      <p className="mt-8 text-center text-base">
        Não tem conta?{" "}
        <Link
          href={next !== "/inicio" ? `/cadastro?next=${encodeURIComponent(next)}` : "/cadastro"}
          className="font-bold text-pegar underline underline-offset-4"
        >
          Criar conta
        </Link>
      </p>
    </main>
  );
}
