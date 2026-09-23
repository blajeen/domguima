import type { ComponentPropsWithoutRef } from "react";
import { Icon, type IconName } from "./Icon";

export type IconButtonVariant = "fantasma" | "contorno" | "sobre-escuro" | "vidro" | "dentro-do-vidro";
export type IconButtonSize = "sm" | "md" | "lg";

// Toque: muda a cor e desce 1 px na pressão, na duração de toque da loja.
const toque =
  "transition-[color,background-color,border-color,translate] duration-(--duracao-toque) ease-out active:translate-y-px";

const variants: Record<IconButtonVariant, string> = {
  // Sobre fundo claro, sem moldura (ex.: fechar a gaveta).
  fantasma: `${toque} rounded-control text-grafite-700 hover:bg-grafite-900/5 hover:text-grafite-900`,
  // Sobre fundo claro, com fio de 1 px.
  contorno: `${toque} rounded-control border border-fio bg-white text-grafite-900 hover:border-grafite-900`,
  // Sobre o grafite do header e do rodapé.
  "sobre-escuro": `${toque} rounded-control text-papel hover:bg-white/10`,
  // Sobre foto ou conteúdo que rola (setas, controles da galeria). Sem
  // transição e sem descer na pressão: elemento com backdrop-filter que anima
  // recompõe o desfoque a cada quadro. O ícone fica sempre papel (ouro-claro
  // sobre o vidro, com foto branca atrás, cai para 2,8:1). Hover e pressão
  // acendem um fio em volta; mexer no fundo desfaria o vidro.
  vidro:
    "glass-dark rounded-pill text-papel hover:ring-1 hover:ring-papel/40 active:ring-1 active:ring-papel/70",
  // Dentro de uma superfície de vidro que já existe (a pílula da galeria no
  // celular): sem vidro próprio, que seria vidro sobre vidro, mas com a forma
  // e o fio da variante `vidro`, por dentro para não vazar da pílula. O foco
  // também fica por dentro e em papel: o ouro do foco padrão some no vidro.
  "dentro-do-vidro":
    "rounded-pill text-papel hover:ring-1 hover:ring-inset hover:ring-papel/40 active:ring-1 active:ring-inset active:ring-papel/70 focus-visible:-outline-offset-2 focus-visible:outline-papel",
};

// O padrão (md) tem 44 px: alvo de toque confortável para o polegar.
const sizes: Record<IconButtonSize, { box: string; icon: number }> = {
  sm: { box: "size-8", icon: 18 },
  md: { box: "size-11", icon: 20 },
  lg: { box: "size-12", icon: 22 },
};

type IconButtonProps = Omit<ComponentPropsWithoutRef<"button">, "children" | "aria-label"> & {
  icon: IconName;
  /** Nome acessível da ação — obrigatório, o botão não tem texto visível. */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
};

export function IconButton({
  icon,
  label,
  variant = "fantasma",
  size = "md",
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  const { box, icon: iconSize } = sizes[size];
  return (
    <button
      type={type}
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40 ${box} ${variants[variant]} ${className}`}
      {...props}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}
