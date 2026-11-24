import { describe, expect, it } from "vitest";
import { formatDateTime, formatPrice } from "@/lib/format";
import { rideSharePath } from "@/lib/share";
import {
  arrivedMessage,
  driverCancelMessage,
  passengerCancelMessage,
  reservationMessage,
  rideShareMessage,
  routeStartedMessage,
  whatsappShareUrl,
  whatsappUrl,
} from "@/lib/whatsapp";

describe("whatsappUrl", () => {
  it("usa wa.me com telefone só em dígitos e texto codificado", () => {
    const url = whatsappUrl("(35) 99999-1234", "Olá & tchau?");
    expect(url).toBe("https://wa.me/5535999991234?text=Ol%C3%A1%20%26%20tchau%3F");
  });

  it("recusa telefone inválido (não gera link)", () => {
    expect(whatsappUrl("abc", "oi")).toBeNull();
    expect(whatsappUrl("123/../evil", "oi")).toBeNull();
  });

  it("não permite injeção de parâmetros pela mensagem", () => {
    const url = whatsappUrl("35999991234", "x&phone=5511000000000#y")!;
    const parsed = new URL(url);
    expect(parsed.host).toBe("wa.me");
    expect(parsed.pathname).toBe("/5535999991234");
    expect([...parsed.searchParams.keys()]).toEqual(["text"]);
    expect(parsed.searchParams.get("text")).toBe("x&phone=5511000000000#y");
  });
});

describe("mensagens", () => {
  // 10:30Z = 07:30 em São Paulo (manhã); 16:00Z = 13:00 (tarde); 23:00Z = 20:00 (noite)
  it("manhã", () => {
    expect(reservationMessage("Esquinão", "TO_CAMPUS", new Date("2026-09-23T10:30:00Z"))).toBe(
      "Olá, bom dia! Acabei de reservar uma carona de ida para a UNIFAL com você. Irei esperar no ponto Esquinão.",
    );
  });
  it("tarde", () => {
    expect(reservationMessage("VN", "TO_CAMPUS", new Date("2026-09-23T16:00:00Z"))).toBe(
      "Olá, boa tarde! Acabei de reservar uma carona de ida para a UNIFAL com você. Irei esperar no ponto VN.",
    );
  });
  it("noite", () => {
    expect(reservationMessage("Shopping", "TO_CAMPUS", new Date("2026-09-23T23:00:00Z"))).toBe(
      "Olá, boa noite! Acabei de reservar uma carona de ida para a UNIFAL com você. Irei esperar no ponto Shopping.",
    );
  });
  it("remove quebras de linha do nome do ponto", () => {
    expect(reservationMessage("A\nB", "TO_CAMPUS", new Date("2026-09-23T10:30:00Z"))).toContain("ponto A B.");
  });
  it("volta: pergunta onde encontrar e diz onde desce", () => {
    expect(reservationMessage("Jomps", "FROM_CAMPUS", new Date("2026-09-23T21:00:00Z"))).toBe(
      "Olá, boa noite! Acabei de reservar uma carona de volta com você. Onde posso te encontrar? Irei descer no ponto Jomps.",
    );
  });
  it("cancelamentos com horário da carona", () => {
    expect(passengerCancelMessage("2026-09-23T10:30:00Z")).toBe(
      "Olá! Precisei cancelar minha reserva da carona das 07:30. Desculpe pelo transtorno.",
    );
    expect(driverCancelMessage("2026-09-23T21:15:00Z")).toBe(
      "Olá! Precisei cancelar a carona das 18:15. Peço desculpas pelo transtorno.",
    );
  });
});

describe("compartilhar carona", () => {
  it("wa.me sem número (a pessoa escolhe o contato)", () => {
    expect(whatsappShareUrl("a b&c")).toBe("https://wa.me/?text=a%20b%26c");
  });

  it("mensagem com sentido, horário, preço, vagas, pontos, link e aviso de notificações", () => {
    const ride = {
      direction: "TO_CAMPUS" as const,
      departureAt: "2026-09-29T10:30:00Z",
      price: 5,
      availableSeats: 2,
      points: ["Esquinão", "Shop\nping"],
    };
    expect(rideShareMessage(ride, "https://app.test/carona/abc").split("\n")).toEqual([
      "🚗 Carona de ida para a UNIFAL",
      `${formatDateTime("2026-09-29T10:30:00Z")} · ${formatPrice(5)} · 2 vagas`,
      "Pontos: Esquinão → Shop ping",
      "Reserve pelo app e ative as notificações para saber quando eu sair: https://app.test/carona/abc",
    ]);
    expect(rideShareMessage({ ...ride, direction: "FROM_CAMPUS", availableSeats: 1 }, "x").split("\n").slice(0, 2)).toEqual([
      "🚗 Carona de volta da UNIFAL",
      `${formatDateTime("2026-09-29T10:30:00Z")} · ${formatPrice(5)} · 1 vaga`,
    ]);
  });

  it("caminho do link público", () => {
    expect(rideSharePath("abc")).toBe("/carona/abc");
  });
});

describe("avisos de rota e chegada pelo WhatsApp", () => {
  const morning = new Date("2026-09-25T10:00:00Z"); // 07:00 em São Paulo

  it("rota iniciada na ida e na volta", () => {
    expect(routeStartedMessage("TO_CAMPUS", "Esquinão", "2026-09-25T10:30:00Z", morning)).toBe(
      "Olá, bom dia! Iniciei a rota da carona. Chego no ponto Esquinão por volta das 07:30.",
    );
    expect(routeStartedMessage("FROM_CAMPUS", "Esquinão", "2026-09-25T10:30:00Z", morning)).toBe(
      "Olá, bom dia! Iniciei a rota da carona de volta. Te encontro na UNIFAL às 07:30.",
    );
  });

  it("chegada do passageiro", () => {
    expect(arrivedMessage("TO_CAMPUS", "Esquinão")).toBe("Olá! Já estou no ponto Esquinão.");
    expect(arrivedMessage("FROM_CAMPUS", "Esquinão")).toBe("Olá! Já estou no local combinado na UNIFAL.");
  });
});
