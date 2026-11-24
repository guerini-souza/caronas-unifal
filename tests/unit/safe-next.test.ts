import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext (anti open redirect)", () => {
  it.each(["/inicio", "/pegar/abc?ponto=1", "/perfil"])("aceita %s", (v) => {
    expect(safeNext(v)).toBe(v);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/ /evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "",
    undefined,
    ["/inicio"],
    // Segmentos "." e ".." que o navegador normaliza para "//evil.com" (auditoria de 25/09/2026).
    "/..//evil.com",
    "/.//evil.com",
    "/%2e%2e//evil.com",
  ])("rejeita %j", (v) => {
    expect(safeNext(v, "/fallback")).toBe("/fallback");
  });

  it("normaliza segmentos internos sem sair do app", () => {
    expect(safeNext("/pegar/../reservas")).toBe("/reservas");
  });
});
