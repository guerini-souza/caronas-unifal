import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "@/lib/push/endpoint";
import { arrivedPush, reminderPush, routeStartedPush } from "@/lib/push/messages";

describe("isAllowedPushEndpoint", () => {
  it("aceita os serviços de push dos navegadores", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc:123")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QGx1c3Q")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=abc")).toBe(true);
  });

  it("recusa qualquer outro endereço", () => {
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isAllowedPushEndpoint("https://evil.com/fcm.googleapis.com/")).toBe(false);
    expect(isAllowedPushEndpoint("https://googleapis.com.evil.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://notgoogleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://storage.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://push.apple.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("não é url")).toBe(false);
    expect(isAllowedPushEndpoint(`https://fcm.googleapis.com/${"a".repeat(1000)}`)).toBe(false);
  });
});

describe("textos das notificações", () => {
  const rideId = "11111111-1111-1111-1111-111111111111";

  it("lembrete com e sem passageiros", () => {
    expect(reminderPush(rideId, 2)).toEqual({
      title: "🚗 Sua carona sai em 10 min",
      body: "2 passageiros esperando. Toque para iniciar a rota.",
      url: `/minhas-caronas/${rideId}`,
      tag: `lembrete-${rideId}`,
    });
    expect(reminderPush(rideId, 1).body).toBe("1 passageiro esperando. Toque para iniciar a rota.");
    expect(reminderPush(rideId, 0).body).toBe("Ninguém reservou ainda. Toque para ver ou compartilhar a carona.");
  });

  it("rota iniciada na ida e na volta (horário de São Paulo)", () => {
    const base = { rideId, driverName: "Pedro", departureAt: "2026-09-25T10:30:00Z", pointName: "Esquinão" };
    expect(routeStartedPush({ ...base, direction: "TO_CAMPUS" })).toEqual({
      title: "🚗 Pedro iniciou a rota",
      body: "Esteja no ponto Esquinão às 07:30.",
      url: "/reservas",
      tag: `rota-${rideId}`,
    });
    expect(routeStartedPush({ ...base, direction: "FROM_CAMPUS" }).body).toBe(
      "Te encontro na UNIFAL às 07:30. Você desce em Esquinão.",
    );
    expect(routeStartedPush({ ...base, driverName: "", direction: "TO_CAMPUS" }).title).toBe("🚗 O motorista iniciou a rota");
  });

  it("chegada do passageiro na ida e na volta (um aviso por passageiro na carona)", () => {
    const base = { rideId, passengerId: "p1", passengerName: "Ana", pointName: "Shopping" };
    expect(arrivedPush({ ...base, direction: "TO_CAMPUS" })).toEqual({
      title: "📍 Ana está no local",
      body: "Esperando no ponto Shopping.",
      url: `/minhas-caronas/${rideId}`,
      tag: `chegada-${rideId}-p1`,
    });
    expect(arrivedPush({ ...base, direction: "FROM_CAMPUS" }).body).toBe("Esperando no local combinado na UNIFAL.");
  });
});
