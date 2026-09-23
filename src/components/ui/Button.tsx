import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

export type ButtonVariant = "primario" | "secundario" | "whatsapp" | "fantasma" | "claro";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ocupa a largura toda do contêiner. */
  fullWidth?: boolean;
  className?: string;
}

// Pressão muda a posição em 1 px; nada de crescer (scale) nem de seta no rótulo.
const base =
  "inline-flex items-center justify-center gap-2 rounded-control text-center font-semibold leading-tight transition-[color,background-color,border-color,translate] duration-(--duracao-toque) ease-out active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0";

const variants: Record<ButtonVariant, string> = {
  // Ação principal da tela: grafite com texto papel (15:1).
  primario:
    "bg-grafite-900 text-papel hover:bg-grafite-800 disabled:bg-papel-escuro disabled:text-ink-400",
  // Segunda ação: contorno grafite de 1 px.
  secundario:
    "border border-grafite-900 text-grafite-900 hover:bg-grafite-900/5 disabled:border-fio disabled:text-ink-400 disabled:hover:bg-transparent",
  // Só ações que abrem o WhatsApp. Texto grafite: branco no verde não passa no AA.
  whatsapp:
    "bg-whatsapp text-grafite-900 hover:bg-whatsapp-escuro disabled:bg-papel-escuro disabled:text-ink-400",
  // Terceira ação, sem moldura (ex.: "Continuar comprando").
  fantasma:
    "text-grafite-900 hover:bg-grafite-900/5 disabled:text-ink-400 disabled:hover:bg-transparent",
  // Ação principal sobre fundo grafite (hero, rodapé, convite escuro): inverte.
  claro:
    "bg-papel text-grafite-900 hover:bg-white disabled:bg-grafite-800 disabled:text-ink-300",
};

// Em tela de toque nenhum tamanho fica abaixo de 44 px de altura.
const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3.5 py-1.5 text-sm pointer-coarse:min-h-11",
  md: "min-h-11 px-5 py-2.5 text-sm",
  lg: "min-h-12 px-6 py-3 text-base",
};

/** Classes do botão, para aplicar em elementos que não são <button> nem <Link>. */
export function buttonStyles({
  variant = "primario",
  size = "md",
  fullWidth = false,
  className = "",
}: ButtonStyleOptions = {}): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`;
}

/**
 * Link de texto da loja ("Ver todos", ação dentro de card): sublinhado em ouro.
 * A caixa tem 44 px de altura para o toque; quem precisar manter o desenho
 * compacto devolve o espaço com margem negativa (ex.: `-my-2.5`).
 */
export const textLinkStyles =
  "inline-flex min-h-11 items-center text-sm font-semibold text-grafite-900 underline decoration-ouro decoration-1 underline-offset-4 transition-colors duration-(--duracao-toque) hover:text-ouro-texto";

/** Atalho em forma de chip (ex.: categoria): tocável, raio de controle e fio de 1 px. */
export const chipStyles =
  "inline-flex min-h-11 items-center gap-2 rounded-control border border-fio bg-white px-3.5 py-2 text-sm font-medium text-grafite-900 transition-colors duration-(--duracao-toque) hover:border-grafite-900";

type ButtonProps = ButtonStyleOptions & ComponentPropsWithoutRef<"button">;

export function Button({
  variant,
  size,
  fullWidth,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, fullWidth, className })}
      {...props}
    />
  );
}

type ButtonLinkProps = ButtonStyleOptions & ComponentPropsWithoutRef<typeof Link>;

/** Link de navegação com cara de botão. */
export function ButtonLink({ variant, size, fullWidth, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonStyles({ variant, size, fullWidth, className })} {...props} />;
}
