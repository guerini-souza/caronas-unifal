import { BottomNavigation } from "@/components/BottomNavigation";
import { PushSync } from "@/components/PushSync";
import { createClient } from "@/lib/supabase/server";

// Área logada. A proteção é feita no proxy e novamente em cada página (requireUser/requireProfile).
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return (
    <>
      <main className="pb-safe-nav px-5 pt-4">{children}</main>
      <BottomNavigation />
      {userId ? <PushSync userId={userId} /> : null}
    </>
  );
}
