import { describe, expect, it } from "vitest";
import { formatCoordinates, mapsUrl, parseCoordinates } from "@/lib/geo";
import { sniffImage } from "@/lib/image";

describe("parseCoordinates", () => {
  it("lê números colados do Google Maps", () => {
    expect(parseCoordinates("-21.787612, -46.561345")).toEqual({ lat: -21.787612, lng: -46.561345 });
    expect(parseCoordinates("  -21.78 -46.56 ")).toEqual({ lat: -21.78, lng: -46.56 });
  });

  it("lê coordenadas de links do Google Maps", () => {
    expect(parseCoordinates("https://www.google.com/maps/@-21.7876,-46.5613,17z")).toEqual({ lat: -21.7876, lng: -46.5613 });
    expect(parseCoordinates("https://www.google.com/maps/search/?api=1&query=-21.78%2C-46.56")).toEqual({ lat: -21.78, lng: -46.56 });
  });

  it("arredonda para 6 casas", () => {
    expect(parseCoordinates("-21.12345678, -46.98765432")).toEqual({ lat: -21.123457, lng: -46.987654 });
  });

  it("rejeita texto sem coordenadas ou fora da faixa", () => {
    expect(parseCoordinates("")).toBeNull();
    expect(parseCoordinates("Rua Tal, 123")).toBeNull();
    expect(parseCoordinates("21, 46")).toBeNull();
    expect(parseCoordinates("95.1, -46.5")).toBeNull();
    expect(parseCoordinates("-21.5, -190.2")).toBeNull();
    expect(parseCoordinates("100%")).toBeNull();
  });

  it("não aproveita pedaço de número digitado errado", () => {
    expect(parseCoordinates("121.5, -46.5")).toBeNull();
    expect(parseCoordinates("-121.78, -46.56")).toBeNull();
    expect(parseCoordinates("-21.78, -1046.56")).toBeNull();
    expect(parseCoordinates("-21.78, -46.56.3")).toBeNull();
  });

  it("formata e monta link do mapa", () => {
    expect(formatCoordinates(-21.7876123, -46.5613987)).toBe("-21.787612, -46.561399");
    expect(mapsUrl(-21.78, -46.56)).toBe("https://www.google.com/maps/search/?api=1&query=-21.78,-46.56");
  });
});

describe("sniffImage", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

  it("reconhece JPEG, PNG e WebP pelos primeiros bytes", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({ type: "image/jpeg", ext: "jpg" });
    expect(sniffImage(bytes(0x89, ...ascii("PNG")))).toEqual({ type: "image/png", ext: "png" });
    expect(sniffImage(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))).toEqual({ type: "image/webp", ext: "webp" });
  });

  it("recusa outros arquivos, mesmo com nome de imagem", () => {
    expect(sniffImage(bytes(...ascii("<html>")))).toBeNull();
    expect(sniffImage(bytes(...ascii("GIF89a")))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});
