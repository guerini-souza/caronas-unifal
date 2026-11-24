import { getPushConfig } from "@/lib/push/config";

export const dynamic = "force-dynamic";

/** Chave pública VAPID (não é segredo): o navegador usa para assinar as notificações. */
export async function GET() {
  const config = await getPushConfig();
  if (!config) return Response.json({ error: "indisponível" }, { status: 503 });
  return Response.json({ publicKey: config.publicKey }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
