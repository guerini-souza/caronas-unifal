import "server-only";

export type EmailMessage = { to: string; subject: string; text: string };
export type EmailResult = { status: "sent" | "failed" | "skipped"; detail?: string };

/** Abstração para trocar de provedor no futuro sem mexer nas regras de negócio. */
export interface EmailProvider {
  readonly enabled: boolean;
  send(message: EmailMessage): Promise<EmailResult>;
}

class ResendProvider implements EmailProvider {
  readonly enabled = true;
  constructor(private apiKey: string, private from: string) {}

  async send({ to, subject, text }: EmailMessage): Promise<EmailResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: this.from, to: [to], subject, text }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { status: "failed", detail: `HTTP ${res.status}` };
      return { status: "sent" };
    } catch (e) {
      return { status: "failed", detail: e instanceof Error ? e.message : "erro" };
    }
  }
}

/** Sem credenciais: não envia, apenas registra como "skipped". */
class DisabledProvider implements EmailProvider {
  readonly enabled = false;
  async send(): Promise<EmailResult> {
    return { status: "skipped", detail: "RESEND_API_KEY não configurada" };
  }
}

export function getEmailProvider(): EmailProvider {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (key && from) return new ResendProvider(key, from);
  return new DisabledProvider();
}
