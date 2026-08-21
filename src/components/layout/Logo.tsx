import Image from "next/image";
import Link from "next/link";
import { site } from "@/config/site";

/**
 * Marca da Dom Guima. Usa a logo oficial (asset real do lojista) como símbolo,
 * acompanhada do letreiro tipográfico — que garante legibilidade em tamanho
 * pequeno, onde o dourado da arte sozinho não se sustenta.
 *
 * Para trocar por uma logo nova, basta substituir
 * /public/brand/logo-dom-guima.png mantendo o formato quadrado.
 */
export function Logo({
  variant = "dark",
  className = "",
  compact = false,
}: {
  /** "dark" = sobre fundo escuro (header/rodapé). "light" = sobre fundo claro. */
  variant?: "dark" | "light";
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label={`${site.name} — página inicial`}
      className={`flex shrink-0 items-center ${compact ? "gap-2" : "gap-2.5"} ${className}`}
    >
      <Image
        src="/brand/logo-dom-guima.png"
        alt=""
        width={44}
        height={44}
        priority
        className={`${compact ? "h-9 w-9 sm:h-10 sm:w-10" : "h-9 w-9 sm:h-11 sm:w-11"} object-contain`}
      />
      <span className="flex flex-col leading-none">
        <span
          className={`${compact ? "text-base" : "text-base sm:text-lg"} font-extrabold tracking-tight ${
            variant === "dark" ? "text-white" : "text-ink-900"
          }`}
        >
          DOM<span className="text-gold-400">GUIMA</span>
        </span>
        <span
          className={`mt-0.5 hidden font-medium uppercase tracking-[0.18em] sm:block ${compact ? "text-[9px]" : "text-[10px]"} ${
            variant === "dark" ? "text-ink-300" : "text-ink-400"
          }`}
        >
          {site.tagline}
        </span>
      </span>
    </Link>
  );
}
