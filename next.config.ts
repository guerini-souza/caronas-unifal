import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proteção contra "version skew": se o site for atualizado enquanto alguém está com
  // uma tela aberta, o Next.js recarrega a página em vez de falhar ao chamar o servidor.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
  // Envio de notificações (Web Push) usa módulos nativos do Node; fica fora do bundle.
  serverExternalPackages: ["web-push"],
};

export default nextConfig;
