import Image from "next/image";
import Link from "next/link";
import { site } from "@/config/site";

/**
 * Marca da Dom Guima: o emblema oficial (arte do lojista; o arquivo não se
 * mexe) ao lado do letreiro "Dom Guima" em Bodoni Moda. É o letreiro que dá a
 * leitura em tamanho pequeno, onde o dourado da arte sozinho não se sustenta.
 * Embaixo, "Empório das Ofertas" pequeno, na fonte da interface.
 *
 * Para trocar por uma logo nova, basta substituir
 * /public/brand/logo-dom-guima.png mantendo o formato quadrado.
 */
export function Logo({
  variant = "dark",
  className = "",
}: {
  /** "dark" = sobre grafite (header e rodapé). "light" = sobre fundo claro. */
  variant?: "dark" | "light";
  className?: string;
}) {
  const escuro = variant === "dark";

  return (
    <Link
      href="/"
      aria-label={`${site.name}, página inicial`}
      // 44 px de altura no mínimo: no celular o desenho tem 36 px, e o link é
      // alvo de toque.
      className={`flex min-h-11 shrink-0 items-center gap-2.5 ${className}`}
    >
      <Image
        src="/brand/logo-dom-guima.png"
        alt=""
        // Pedido no maior tamanho exibido (44 px, a partir de lg): o srcset sai
        // com 48 e 96 px, e não com o PNG de 1024 px.
        width={44}
        height={44}
        // Sem preload. O React põe um <link rel="preload"> no <head> para toda
        // imagem que não é lazy nem de prioridade baixa; com `low`, o emblema
        // (sempre no topo, por isso `eager`) carrega depois da foto principal.
        loading="eager"
        fetchPriority="low"
        className="size-9 object-contain sm:size-10 lg:size-11"
      />
      <span className="flex flex-col">
        <span
          className={`font-brand text-xl font-bold leading-none sm:text-titulo ${
            escuro ? "text-ouro-claro" : "text-grafite-900"
          }`}
        >
          {site.name}
        </span>
        <span
          // Papel, e não cinza, sobre o grafite: o header vira vidro sobre o
          // banner da home, e texto pequeno cinza não passaria no contraste lá.
          className={`mt-1 text-xs leading-none ${escuro ? "text-papel" : "text-ink-600"}`}
        >
          {site.tagline}
        </span>
      </span>
    </Link>
  );
}
