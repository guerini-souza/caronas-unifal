// Grava no Vault do Supabase os segredos das notificações (uma vez por projeto).
// Uso: npm run setup:push   (lê SUPABASE_DB_URL do .env.local; PUSH_APP_URL troca a URL do app)
// SUPABASE_CA_CERT: caminho do certificado baixado em Supabase → Database → SSL (verifica a conexão).
// Segredos existentes são mantidos: trocar as chaves VAPID desligaria os celulares já cadastrados.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import webpush from "web-push";

const DB_URL = process.env.SUPABASE_DB_URL;
const APP_URL = process.env.PUSH_APP_URL ?? "https://app-caronas-seven.vercel.app";
if (!DB_URL) {
  console.error("Defina SUPABASE_DB_URL no .env.local.");
  process.exit(2);
}

const vapid = webpush.generateVAPIDKeys();
const wanted = {
  app_url: APP_URL,
  cron_secret: randomBytes(32).toString("base64url"),
  vapid_public_key: vapid.publicKey,
  vapid_private_key: vapid.privateKey,
};

// Com o certificado do Supabase, a conexão é verificada; sem ele, é cifrada mas sem verificar o servidor
// (como o sslmode=require da CLI do Supabase).
const caPath = process.env.SUPABASE_CA_CERT;
if (!caPath) console.warn("Aviso: sem SUPABASE_CA_CERT a conexão não verifica o certificado do servidor.");
const ssl = caPath ? { ca: readFileSync(caPath, "utf8") } : { rejectUnauthorized: false };
const client = new pg.Client({ connectionString: DB_URL, ssl });
await client.connect();
try {
  const { rows } = await client.query("select name from vault.secrets where name = any($1::text[])", [Object.keys(wanted)]);
  const existing = new Set(rows.map((r) => r.name));
  // As duas chaves VAPID andam juntas: só cria se nenhuma existir.
  const vapidExists = existing.has("vapid_public_key") || existing.has("vapid_private_key");
  for (const [name, value] of Object.entries(wanted)) {
    if (existing.has(name) || (name.startsWith("vapid_") && vapidExists)) {
      console.log(`${name}: já existe (mantido)`);
      continue;
    }
    await client.query("select vault.create_secret($1, $2, $3)", [value, name, `Caronas UNIFAL: ${name}`]);
    console.log(`${name}: criado`);
  }
} finally {
  await client.end();
}
