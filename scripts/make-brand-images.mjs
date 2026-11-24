// Gera public/brand/og.png (cartão do link no WhatsApp) e public/brand/badge-96.png
// (ícone monocromático da barra de notificações do Android). Uso: node scripts/make-brand-images.mjs
import { readFileSync } from "node:fs";
import sharp from "sharp";

const logo = "src/assets/logo.webp";
const [r, g, b] = await sharp(logo).extract({ left: 4, top: 4, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
const logoPng = await sharp(logo).resize(560, 560).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: { r, g, b } } })
  .composite([{ input: logoPng, left: 320, top: 35 }])
  .png({ compressionLevel: 9 })
  .toFile("public/brand/og.png");

// Mesmo desenho do IconCar (src/components/icons.tsx), em branco sobre fundo transparente.
const icons = readFileSync("src/components/icons.tsx", "utf8");
const body = icons.match(/CAR_BODY =\s*"([^"]+)"/)[1];
const wheels = [...icons.matchAll(/\{ cx: ([\d.]+), cy: ([\d.]+) \}/g)].map((m) => ({ cx: Number(m[1]), cy: Number(m[2]) }));
const holes = wheels.map(({ cx, cy }) => `<circle cx="${cx}" cy="${cy}" r="3.2" fill="black"/>`).join("");
const tires = wheels
  .map(({ cx, cy }) => `<path fill-rule="evenodd" d="M${cx} ${cy - 2.3}a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6Zm0 1.5a.8.8 0 1 1 0 1.6a.8.8 0 1 1 0-1.6Z"/>`)
  .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="white"><defs><mask id="m"><rect width="24" height="24" fill="white"/>${holes}</mask></defs><path fill-rule="evenodd" d="${body}" mask="url(#m)"/>${tires}</svg>`;
await sharp(Buffer.from(svg)).resize(96, 96).png().toFile("public/brand/badge-96.png");
console.log("public/brand/og.png e public/brand/badge-96.png gerados");
