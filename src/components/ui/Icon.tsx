import type { ReactElement, SVGProps } from "react";

/**
 * Conjunto único de ícones da loja: grade de 24 px, traço de 1,75 px com
 * pontas arredondadas e currentColor. Substitui os emojis de interface (que
 * mudam de desenho em cada sistema) e os SVGs soltos de cada componente.
 *
 * Logotipos de terceiros coloridos (Google e Shopee nas notas da loja) e o
 * glifo cheio do WhatsApp no botão flutuante não entram aqui: são marca, não
 * ícone de interface. O `shopee` daqui é um monograma neutro, não o logo.
 */
const glyphs = {
  // Categorias da loja (ver categoryIcon em lib/catalog/categories.ts).
  tv: (
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="1.5" />
      <path d="M8.5 20.5h7M12 17v3.5" />
    </>
  ),
  celular: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.2" />
      <path d="M11 18.5h2" />
    </>
  ),
  eletrodomestico: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
      <rect x="5" y="8" width="10" height="8" rx="0.8" />
      <path d="M17.75 9h1.25M17.75 12h1.25M17.75 15h1.25" />
    </>
  ),
  climatizacao: (
    <>
      <rect x="2.5" y="4.5" width="19" height="8.5" rx="1.5" />
      <path d="M6 10h12M8 16.5c0 1.5-1.2 2-1.2 3.5M12 16.5V20M16 16.5c0 1.5 1.2 2 1.2 3.5" />
    </>
  ),
  eletronicos: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <path d="M4 14.5h2.5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M20 14.5h-2.5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1z" />
    </>
  ),
  informatica: (
    <>
      <rect x="4" y="4.5" width="16" height="11" rx="1.2" />
      <path d="M2 19.5h20" />
    </>
  ),
  ferramentas: (
    <path d="M20.1 6.55A5 5 0 0 1 13.39 13.03L7.03 19.39a1.71 1.71 0 0 1-2.42-2.42l6.36-6.36A5 5 0 0 1 17.45 3.9l-2.26 2.26 2.65 2.65z" />
  ),
  casa: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 8.8v11.7h13V8.8" />
      <path d="M10 20.5v-6h4v6" />
    </>
  ),
  beleza: (
    <>
      <circle cx="14.5" cy="9" r="5" />
      <circle cx="14.5" cy="9" r="1.5" />
      <path d="M9.8 7.2 3.5 6.5v5l6.3-.7" />
      <path d="m13 13.8-1 6.7h3.2l1.3-6" />
    </>
  ),

  // Navegação e ações.
  busca: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </>
  ),
  carrinho: (
    <>
      <path d="M3 4h2.2l2 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20.5 8H6" />
      <circle cx="10" cy="20" r="1.25" />
      <circle cx="17" cy="20" r="1.25" />
    </>
  ),
  usuario: (
    <>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 20c.6-3.7 3.6-5.8 7.2-5.8s6.6 2.1 7.2 5.8" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  fechar: <path d="M6 6l12 12M18 6 6 18" />,
  "seta-esquerda": <path d="M14.5 5.5 8 12l6.5 6.5" />,
  "seta-direita": <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  "seta-baixo": <path d="m6 9.5 6 6 6-6" />,
  filtro: <path d="M4 7h16M7 12h10M10 17h4" />,
  check: <path d="M5 12.5 9.5 17 19 7.5" />,

  // Canais.
  whatsapp: (
    <>
      <path d="M4.64 15.75A8.5 8.5 0 1 1 8.41 19.2L3.5 20.5z" />
      <path d="M9.3 7.5h1.4l.9 2.2-1.1.9a5.6 5.6 0 0 0 2.9 2.9l.9-1.1 2.2.9v1.4a1.3 1.3 0 0 1-1.4 1.3A7.4 7.4 0 0 1 8 9a1.3 1.3 0 0 1 1.3-1.5z" />
    </>
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  shopee: (
    <>
      <path d="M5 8h14l-1 12.5H6z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      <path d="M14 11.4c-.6-.4-1.3-.6-2.1-.6-1.2 0-2 .6-2 1.5 0 2.1 4.3 1.1 4.3 3.6 0 1-.9 1.7-2.3 1.7-.9 0-1.7-.2-2.4-.7" />
    </>
  ),
  telefone: (
    <path d="M6.2 3.5h2.9l1.6 4.1-2.1 1.5a11 11 0 0 0 6.3 6.3l1.5-2.1 4.1 1.6v2.9a2 2 0 0 1-2.1 2A16.4 16.4 0 0 1 4.2 5.6a2 2 0 0 1 2-2.1z" />
  ),
  conversa: (
    <path d="M4 5.5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4.5 3.5v-3.5H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" />
  ),

  // Compra, entrega e confiança.
  caminhao: (
    <>
      <path d="M8.8 17h4.7V6h-10a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h1.7" />
      <path d="M13.5 9h3.9l3.1 3.6V16a1 1 0 0 1-1 1h-.7M15.2 17h-1.7" />
      <circle cx="7" cy="17" r="1.8" />
      <circle cx="17" cy="17" r="1.8" />
    </>
  ),
  pix: (
    <>
      <path d="M12 3 21 12 12 21 3 12z" />
      <path d="M12 8.5 15.5 12 12 15.5 8.5 12z" />
    </>
  ),
  cartao: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="1.8" />
      <path d="M2.5 9.5h19M6 15h4" />
    </>
  ),
  cadeado: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="1.8" />
      <path d="M8 10.5v-3a4 4 0 0 1 8 0v3M12 14.5V17" />
    </>
  ),
  estrela: (
    <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.78l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85z" />
  ),
  localizacao: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  caixa: (
    <>
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9M7.8 5.2l8.5 4.6" />
    </>
  ),
  troca: (
    <>
      <path d="M9 5.5 4.5 10 9 14.5" />
      <path d="M4.5 10H15a4.5 4.5 0 0 1 0 9h-3" />
    </>
  ),
  relogio: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  oferta: (
    <>
      <path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1.4 1.4 0 0 1 0 2l-6.8 6.8a1.4 1.4 0 0 1-2 0z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.75v.1" />
    </>
  ),
  alerta: (
    <>
      <path d="M10.3 4.2 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5V14M12 17v.1" />
    </>
  ),
} satisfies Record<string, ReactElement>;

/** Nomes alternativos pedidos pela especificação para o mesmo desenho. */
const aliases = {
  entrega: "caminhao",
  tag: "oferta",
} as const satisfies Record<string, keyof typeof glyphs>;

export type IconName = keyof typeof glyphs | keyof typeof aliases;

function resolve(name: IconName): keyof typeof glyphs {
  return name in aliases ? aliases[name as keyof typeof aliases] : (name as keyof typeof glyphs);
}

type IconProps = Omit<SVGProps<SVGSVGElement>, "name" | "children"> & {
  name: IconName;
  /** Tamanho em px (a especificação usa 20 e 24). */
  size?: number;
  /**
   * Nome acessível. Sem ele o ícone é decorativo (aria-hidden) e o texto ao
   * lado, ou o aria-label do botão, é quem descreve a ação.
   */
  title?: string;
};

export function Icon({ name, size = 20, title, className = "", ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`shrink-0 ${className}`}
      {...rest}
    >
      {glyphs[resolve(name)]}
    </svg>
  );
}
