import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/States";

export default function NotFound() {
  return (
    <main className="px-5 pt-16">
      <EmptyState
        title="Página não encontrada"
        description="O link pode estar errado ou a carona não existe mais."
        action={
          <AppButton href="/" variant="pegar">
            IR PARA O INÍCIO
          </AppButton>
        }
      />
    </main>
  );
}
