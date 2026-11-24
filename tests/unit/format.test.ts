import { describe, expect, it } from "vitest";
import {
  combineDateTime,
  formatPhone,
  formatTime,
  hourInAppTz,
  maskPlate,
  normalizePhone,
  normalizePlate,
  parsePrice,
  periodOfDay,
} from "@/lib/format";

describe("normalizePhone", () => {
  it.each([
    ["(35) 99999-1234", "5535999991234"],
    ["+55 35 99999-1234", "5535999991234"],
    ["035999991234", "5535999991234"],
    ["35 3721-1234", "553537211234"],
    ["5535999991234", "5535999991234"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "123", "abc", "(35) 89999-1234", "5500999991234", "35999991234567"])("rejeita %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("formata para exibição", () => {
    expect(formatPhone("5535999991234")).toBe("(35) 99999-1234");
  });
});

describe("placa", () => {
  it("normaliza padrão antigo e Mercosul", () => {
    expect(normalizePlate("abc-1234")).toBe("ABC1234");
    expect(normalizePlate("ABC1D23")).toBe("ABC1D23");
    expect(normalizePlate("AB1234")).toBeNull();
    expect(normalizePlate("ABCD123")).toBeNull();
  });

  it("mascara no formato ABC-***4", () => {
    expect(maskPlate("ABC1234")).toBe("ABC-***4");
    expect(maskPlate("ABC1D23")).toBe("ABC-***3");
    expect(maskPlate("")).toBe("***");
  });
});

describe("parsePrice", () => {
  it.each([
    ["5", 5],
    ["5,00", 5],
    ["R$ 5,50", 5.5],
    ["5.5", 5.5],
    ["0", 0],
    ["1.000,00", 1000],
  ])("%s -> %s", (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });

  it.each(["", "-1", "abc", "5,555", "1000,01"])("rejeita %s", (input) => {
    expect(parsePrice(input)).toBeNull();
  });
});

describe("horário", () => {
  it("combina data e hora no fuso -03:00", () => {
    expect(combineDateTime("2026-09-23", "07:30")?.toISOString()).toBe("2026-09-23T10:30:00.000Z");
    expect(combineDateTime("23/09/2026", "07:30")).toBeNull();
  });

  it("exibe no fuso de São Paulo", () => {
    expect(formatTime("2026-09-23T10:30:00.000Z")).toBe("07:30");
  });

  it("hora local no fuso do app", () => {
    expect(hourInAppTz(new Date("2026-09-23T10:30:00Z"))).toBe(7);
    expect(hourInAppTz(new Date("2026-09-23T02:00:00Z"))).toBe(23);
  });

  it("períodos do dia", () => {
    expect(periodOfDay(5)).toBe("morning");
    expect(periodOfDay(11)).toBe("morning");
    expect(periodOfDay(12)).toBe("afternoon");
    expect(periodOfDay(17)).toBe("afternoon");
    expect(periodOfDay(18)).toBe("night");
    expect(periodOfDay(0)).toBe("night");
    expect(periodOfDay(4)).toBe("night");
  });
});
