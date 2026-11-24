import type { Platform } from "@/components/usePwaInstall";

/** Instruções curtas de instalação quando o navegador não abre a janela nativa. */
export function InstallSteps({ platform, inAppBrowser }: { platform: Platform; inAppBrowser: boolean }) {
  if (inAppBrowser) {
    return (
      <p>
        Toque nos <b>três pontinhos</b> (⋮ ou …) e escolha <b>Abrir no navegador</b>. Depois toque em{" "}
        <b>INSTALAR APP</b> de novo.
      </p>
    );
  }
  if (platform === "ios") {
    return (
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Toque em <b>Compartilhar</b>{" "}
          <span aria-hidden className="inline-block rounded border border-border px-1">
            ⬆️
          </span>{" "}
          na barra do Safari.
        </li>
        <li>
          Role e toque em <b>Adicionar à Tela de Início</b>.
        </li>
        <li>
          Toque em <b>Adicionar</b>.
        </li>
      </ol>
    );
  }
  if (platform === "android") {
    return (
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Toque no menu <b>⋮</b> do Chrome (canto de cima).
        </li>
        <li>
          Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.
        </li>
      </ol>
    );
  }
  return <p>No computador, use o ícone de instalar na barra de endereço do Chrome ou Edge.</p>;
}
