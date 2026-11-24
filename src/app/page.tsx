import { redirect } from "next/navigation";
import { AppButton } from "@/components/AppButton";
import Image from "next/image";
import logo from "@/assets/logo.webp";
import { InstallPWAButton } from "@/components/InstallPWAButton";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Depende da sessão (cookies): sempre dinâmico.
export const dynamic = "force-dynamic";

export default async function IntroPage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) redirect("/inicio");
  }

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-8 pt-12">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Image src={logo} alt="Caronas UNIFAL" width={112} height={112} priority className="rounded-[28px] shadow-lg" />
        <h1 className="mt-6 text-4xl font-extrabold">Caronas UNIFAL</h1>
        <p className="mt-3 max-w-xs text-lg text-muted">
          Ofereça, pegue e descubra os pontos de carona da faculdade.
        </p>
      </div>

      <div className="space-y-3">
        <InstallPWAButton />
        <AppButton href="/entrar" variant="pegar">
          ENTRAR
        </AppButton>
        <AppButton href="/cadastro" variant="ghost">
          CRIAR CONTA
        </AppButton>
        <AppButton href="/pontos" variant="ghost" size="md" className="!border-0 !bg-transparent text-pontos underline underline-offset-4">
          Ver pontos para bixetes
        </AppButton>
      </div>
    </main>
  );
}
