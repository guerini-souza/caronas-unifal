// Fotos dos pontos: reduzidas no celular antes do envio (o Server Action aceita até 1 MB).
export const PHOTO_MAX_BYTES = 900_000;

export type ImageKind = { type: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

/** Confere o tipo pelos primeiros bytes (não confia no nome nem no tipo informado). */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return { type: "image/png", ext: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { type: "image/webp", ext: "webp" };
  return null;
}
