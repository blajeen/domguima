"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { PriceTag } from "@/components/ui/PriceTag";
import type { Banner } from "@/lib/catalog/types";
import { paymentLines } from "@/lib/utils/format";

const AUTOPLAY_MS = 6000;

/**
 * Banner da home, estilo revista: um produto do catálogo por slide, com a
 * chamada da categoria em serifa (quando há) sobre creme claro.
 * Nome do produto, a linha de fato (categoria, novidade), o preço-assinatura e
 * um botão. A foto é a do cadastro, do jeito que está, num poço branco: sem
 * gradiente, halo, mancha desfocada nem sombra desenhada atrás dela.
 *
 * Só a foto do 1º slide tem prioridade (a única da home). As setas e o
 * contador ficam numa pílula grafite sólida no poço branco, fora da foto: sem
 * foto atrás, vidro só pareceria cinza, e somaria uma 4ª superfície de vidro
 * na tela (header e as duas setas das Ofertas logo abaixo).
 */
export function HeroBanner({ banners }: { banners: Banner[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Depois que o cliente troca o slide por conta própria, o banner para de
  // girar sozinho: quem está lendo não perde o slide no meio.
  const [assumiu, setAssumiu] = useState(false);
  // Dedo na tela. O trilho só rola com o dedo quando o cliente arrasta para o
  // lado; rolar a página com o polegar sobre o banner não mexe nele.
  const tocando = useRef(false);

  const goTo = useCallback((target: number) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[target] as HTMLElement | undefined;
    if (!slide) return;
    // "instant", e não "auto": o `.scroll-row` pede rolagem suave no CSS, e o
    // "auto" herdaria isso.
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: slide.offsetLeft, behavior: reduzir ? "instant" : "smooth" });
  }, []);

  // O índice vem da posição real do scroll, então swipe e botões concordam.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame = 0;
    function onScroll() {
      // Trilho rolando com o dedo na tela: é o cliente arrastando o banner.
      if (tocando.current) setAssumiu(true);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = track!.clientWidth;
        if (width > 0) setIndex(Math.round(track!.scrollLeft / width));
      });
    }

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (paused || assumiu || banners.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % banners.length;
        goTo(next);
        return next;
      });
    }, AUTOPLAY_MS);

    return () => clearInterval(timer);
  }, [paused, assumiu, banners.length, goTo]);

  // Não gasta timer com a aba em segundo plano.
  useEffect(() => {
    function onVisibility() {
      setPaused(document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (banners.length === 0) return null;

  const trocar = (target: number) => {
    setAssumiu(true);
    goTo((target + banners.length) % banners.length);
  };

  return (
    <section
      aria-label="Destaques"
      aria-roledescription="carrossel"
      className="relative h-full min-w-0 overflow-hidden rounded-card border border-fio bg-[#f7f4ee]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        className="scroll-row h-full w-full"
        style={{ gridAutoColumns: "100%" }}
        // Só marca o dedo na tela. Quem decide se o cliente assumiu é a
        // rolagem do trilho (acima): um toque que vira rolagem da página não
        // para o giro.
        onTouchStart={() => {
          tocando.current = true;
        }}
        onTouchEnd={(event) => {
          tocando.current = event.touches.length > 0;
        }}
        onTouchCancel={(event) => {
          tocando.current = event.touches.length > 0;
        }}
      >
        {banners.map((banner, i) => (
          <Slide key={banner.id} banner={banner} position={i} total={banners.length} active={i === index} />
        ))}
      </div>

      {banners.length > 1 && (
        // Uma pílula grafite só, com as setas e o contador, no poço branco e
        // fora da foto. No celular o poço é a faixa de cima (13rem): a pílula
        // fica no pé dela, à direita da foto. Do sm em diante o poço é a coluna
        // da direita, e ela desce para o canto, no respiro sob a foto. Os
        // botões são os de dentro da pílula da galeria: sem vidro próprio, com
        // fio e foco em papel por dentro (o foco de fora cairia no branco).
        <div className="absolute right-3 top-44 flex items-center rounded-pill bg-grafite-900 sm:top-auto sm:bottom-4 sm:right-4">
          <IconButton
            icon="seta-esquerda"
            label="Destaque anterior"
            variant="dentro-do-vidro"
            onClick={() => trocar(index - 1)}
          />
          <span aria-hidden className="min-w-10 text-center text-xs font-semibold tabular-nums text-papel">
            {index + 1} / {banners.length}
          </span>
          <IconButton
            icon="seta-direita"
            label="Próximo destaque"
            variant="dentro-do-vidro"
            onClick={() => trocar(index + 1)}
          />
        </div>
      )}
    </section>
  );
}

function Slide({
  banner,
  position,
  total,
  active,
}: {
  banner: Banner;
  position: number;
  total: number;
  active: boolean;
}) {
  const chamada = banner.chamada;
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${position + 1} de ${total}`}
      // Os slides fora da tela saem do Tab e do leitor de tela.
      inert={!active}
      className="grid h-full sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      {/* Estilo revista: fio + categoria em versalete, título em serifa com a
          segunda parte em itálico, uma frase e o botão grafite. */}
      <div className="flex min-w-0 flex-col justify-center px-6 pb-7 pt-6 sm:px-9 sm:py-10 lg:px-12">
        {banner.categoria && (
          <p className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-ouro-texto">
            <span aria-hidden className="h-px w-8 bg-ouro" />
            {banner.categoria}
          </p>
        )}
        {/* h2 em todos: o H1 da home fica fixo na página (page.tsx), fora
            dos slides que saem do leitor de tela. */}
        <h2 className="mt-4 text-balance font-brand text-[2rem] leading-[1.08] text-grafite-900 sm:text-[2.6rem] lg:text-[3rem]">
          {chamada ? (
            <>
              {chamada.titulo} <em className="italic">{chamada.destaque}</em>
            </>
          ) : (
            <span className="line-clamp-3">{banner.title}</span>
          )}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-600">
          {chamada ? chamada.texto : banner.detail}
        </p>
        <div className="mt-5 flex flex-wrap items-end gap-x-5 gap-y-2">
          <PriceTag
            cents={banner.price.price}
            oldCents={banner.price.oldPrice}
            lines={paymentLines(banner.price.cardInstallment)}
          />
        </div>
        {chamada && <p className="mt-1 line-clamp-1 text-xs text-ink-500">{banner.title}</p>}
        <ButtonLink href={banner.href} className="mt-6 w-fit">
          {banner.ctaLabel} <span aria-hidden>→</span>
        </ButtonLink>
      </div>

      {/* Foto do produto num poço creme com volume, preenchendo o lado direito.
          A foto repete o link do botão: fica fora do Tab e do leitor de tela. */}
      <Link
        href={banner.href}
        tabIndex={-1}
        aria-hidden
        className="poco-foto relative order-first block h-56 sm:order-none sm:h-auto sm:min-h-[22rem]"
      >
        {banner.image && (
          <Image
            src={banner.image.src}
            alt=""
            fill
            loading={position === 0 ? "eager" : "lazy"}
            // Os outros slides ficam fora da tela, mas perto: o navegador
            // os baixa logo, e a prioridade baixa deixa a banda para a 1ª.
            fetchPriority={position === 0 ? "high" : "low"}
            sizes="(max-width: 639px) 100vw, 50vw"
            className="object-contain p-4 sm:p-8 sm:pb-16"
          />
        )}
      </Link>
    </div>
  );
}
