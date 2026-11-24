import type { Metadata } from "next";
import { StepHeader } from "@/components/StepHeader";
import { requireUser } from "@/lib/auth";
import { NewPasswordForm } from "./NewPasswordForm";

export const metadata: Metadata = { title: "Nova senha" };

export default async function NewPasswordPage() {
  // Chega aqui logado pelo link do e-mail; sem sessão, vai para o login.
  await requireUser();
  return (
    <main className="px-5 pb-10 pt-4">
      <StepHeader title="Crie uma nova senha" />
      <NewPasswordForm />
    </main>
  );
}
