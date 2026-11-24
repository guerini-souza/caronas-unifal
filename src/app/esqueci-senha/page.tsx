import type { Metadata } from "next";
import { ErrorMessage } from "@/components/States";
import { StepHeader } from "@/components/StepHeader";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default async function ForgotPasswordPage(props: PageProps<"/esqueci-senha">) {
  const sp = await props.searchParams;
  return (
    <main className="px-5 pb-10 pt-4">
      <StepHeader title="Esqueci minha senha" subtitle="Enviamos um link para você criar uma nova." backHref="/entrar" />
      {sp.erro === "1" ? (
        <div className="mb-4">
          <ErrorMessage>Link inválido ou expirado. Peça um novo e abra no mesmo celular/navegador.</ErrorMessage>
        </div>
      ) : null}
      <ForgotForm />
    </main>
  );
}
