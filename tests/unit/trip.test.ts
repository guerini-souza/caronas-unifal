import { describe, expect, it } from "vitest";
import { TRIP_CLOSES_AFTER_MIN, TRIP_OPENS_BEFORE_MIN, tripOpensAt, tripPhase } from "@/lib/trip";

const departure = "2026-09-25T10:30:00.000Z";
const at = (minutes: number) => new Date(Date.parse(departure) + minutes * 60_000);

describe("tripPhase", () => {
  it("usa 30 min antes e 60 min depois (igual ao banco)", () => {
    expect(TRIP_OPENS_BEFORE_MIN).toBe(30);
    expect(TRIP_CLOSES_AFTER_MIN).toBe(60);
  });

  it("aberto de 30 min antes até 60 min depois", () => {
    expect(tripPhase(departure, at(-30))).toBe("open");
    expect(tripPhase(departure, at(0))).toBe("open");
    expect(tripPhase(departure, at(60))).toBe("open");
  });

  it("encerrado depois de 60 min", () => {
    expect(tripPhase(departure, at(61))).toBe("closed");
  });

  it("'soon' até 12 h antes de abrir; 'later' antes disso", () => {
    expect(tripPhase(departure, at(-31))).toBe("soon");
    expect(tripPhase(departure, at(-30 - 12 * 60))).toBe("soon");
    expect(tripPhase(departure, at(-31 - 12 * 60))).toBe("later");
  });

  it("aceita Date e informa quando abre", () => {
    expect(tripPhase(new Date(departure), at(0))).toBe("open");
    expect(tripOpensAt(departure).toISOString()).toBe("2026-09-25T10:00:00.000Z");
  });
});
