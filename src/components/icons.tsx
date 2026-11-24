// Ícones SVG inline (sem dependência externa). Decorativos: aria-hidden.
type P = { className?: string };
const base = (className?: string) => ({
  className: className ?? "h-6 w-6",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconUser = ({ className }: P) => (
  <svg {...base(className)}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
);
/** Carro de lado, preenchido (rodas destacadas por máscara, janelas vazadas). */
export const CAR_BODY =
  "M2.5 15.2V12.9c0-.8.5-1.5 1.3-1.7l2.5-.7 2.3-3.4c.4-.6 1.1-1 1.9-1h4.8c.7 0 1.3.3 1.7.9l2.6 3.5 1.2.4c.7.3 1.2 1 1.2 1.8v2.5c0 .6-.5 1.1-1.1 1.1H3.6c-.6 0-1.1-.5-1.1-1.1ZM9.2 10.4l1.4-2.2c.2-.3.5-.5.9-.5h.9v2.7Zm4.7 0V7.7h1.2c.4 0 .7.2.9.5l1.6 2.2Z";
export const CAR_WHEELS = [
  { cx: 7, cy: 16.3 },
  { cx: 17.4, cy: 16.3 },
];

export const IconCar = ({ className }: P) => (
  <svg className={className ?? "h-6 w-6"} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <defs>
      <mask id="icon-car-wheel-gap">
        <rect width="24" height="24" fill="white" />
        {CAR_WHEELS.map((w) => (
          <circle key={w.cx} cx={w.cx} cy={w.cy} r="3.2" fill="black" />
        ))}
      </mask>
    </defs>
    <path fillRule="evenodd" d={CAR_BODY} mask="url(#icon-car-wheel-gap)" />
    {CAR_WHEELS.map((w) => (
      <path
        key={w.cx}
        fillRule="evenodd"
        d={`M${w.cx} ${w.cy - 2.3}a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6Zm0 1.5a.8.8 0 1 1 0 1.6a.8.8 0 1 1 0-1.6Z`}
      />
    ))}
  </svg>
);

/** Pessoa pedindo carona: braço esticado com o polegar para cima. */
export const IconHitchhike = ({ className }: P) => (
  <svg className={className ?? "h-6 w-6"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="8.5" cy="4.2" r="2.3" fill="currentColor" stroke="none" />
    <rect x="4" y="8.6" width="2.9" height="5" rx="1.2" fill="currentColor" stroke="none" />
    <path d="M8.5 8.4v6" />
    <path d="M8.5 14.4 6.3 21" />
    <path d="M8.5 14.4l2.4 6.6" />
    <path d="M8.5 9.6h7.2" />
    <circle cx="16.8" cy="9.6" r="1.4" fill="currentColor" stroke="none" />
    <path d="M17.2 8.4V5.6" strokeWidth={1.9} />
  </svg>
);
export const IconPin = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
);
export const IconHome = ({ className }: P) => (
  <svg {...base(className)}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
);
export const IconBack = ({ className }: P) => (
  <svg {...base(className)}><path d="M15 18l-6-6 6-6" /></svg>
);
export const IconCheck = ({ className }: P) => (
  <svg {...base(className)}><path d="M5 12l5 5L20 7" /></svg>
);
export const IconClock = ({ className }: P) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconSeat = ({ className }: P) => (
  <svg {...base(className)}><path d="M7 4v9h10M7 13l-1 7M17 13v7M10 4h0" /><circle cx="8" cy="4" r="1" /></svg>
);
export const IconDownload = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
);
export const IconWhatsapp = ({ className }: P) => (
  <svg className={className ?? "h-6 w-6"} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z" />
  </svg>
);
export const IconList = ({ className }: P) => (
  <svg {...base(className)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
);
export const IconBell = ({ className }: P) => (
  <svg {...base(className)}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
);
