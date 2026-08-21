"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Banner } from "@/lib/catalog/types";

const THEMES: Record<Banner["theme"], string> = {
  gold: "from-brand-800 via-brand-700 to-brand-500 text-white",
  ink: "from-brand-950 via-brand-900 to-brand-800 text-white",
  deep: "from-brand-950 via-brand-900 to-gold-900 text-white",
};

const AUTOPLAY_MS = 6000;

/** Carrossel editorial com fotos reais resolvidas a partir do catálogo ativo. */
export function HeroBanner({ banners, compact = false }: { banners: Banner[]; compact?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((target: number) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[target] as HTMLElement | undefined;
    if (slide) track.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
  }, []);

  // O índice vem da posição real do scroll, então swipe e botões concordam.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame = 0;
    function onScroll() {
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
    if (paused || banners.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % banners.length;
        goTo(next);
        return next;
      });
    }, AUTOPLAY_MS);

    return () => clearInterval(timer);
  }, [paused, banners.length, goTo]);

  // Não gasta timer com a aba em segundo plano.
  useEffect(() => {
    function onVisibility() {
      setPaused(document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <section
      aria-label="Destaques"
      aria-roledescription="carrossel"
      className={`relative min-w-0 ${compact ? "h-full overflow-hidden rounded-2xl shadow-card" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        className="scroll-row w-full"
        style={{ gridAutoColumns: "100%" }}
      >
        {banners.map((banner, i) => (
          <div
            key={banner.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${banners.length}`}
            className="w-full"
          >
            <div className={`relative overflow-hidden bg-gradient-to-br ${THEMES[banner.theme]}`}>
              <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
              <div className={compact
                ? "grid min-h-[340px] items-center gap-4 px-5 py-7 sm:grid-cols-[minmax(0,1fr)_minmax(220px,.72fr)] sm:px-7 lg:min-h-[360px] lg:px-8"
                : "site-shell grid min-h-[380px] items-center gap-5 py-9 sm:min-h-[360px] sm:grid-cols-[minmax(0,1.05fr)_minmax(280px,.95fr)] sm:gap-10 sm:py-8 lg:min-h-[410px]"}
              >
                <div className="relative z-10">
                  {banner.eyebrow && (
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] opacity-80">
                      {banner.eyebrow}
                    </p>
                  )}
                  {i === 0 ? (
                    <h1 className={`max-w-3xl font-extrabold leading-[1.04] tracking-tight ${compact ? "text-2xl sm:text-3xl lg:text-4xl" : "text-3xl sm:text-4xl lg:text-5xl xl:text-[3.5rem]"}`}>
                      {banner.title}
                    </h1>
                  ) : (
                    <h2 className={`max-w-3xl font-extrabold leading-[1.04] tracking-tight ${compact ? "text-2xl sm:text-3xl lg:text-4xl" : "text-3xl sm:text-4xl lg:text-5xl xl:text-[3.5rem]"}`}>
                      {banner.title}
                    </h2>
                  )}
                  <p className={`mt-3 max-w-xl text-sm leading-relaxed opacity-90 ${compact ? "" : "sm:text-base"}`}>
                    {banner.subtitle}
                  </p>
                  <BannerCta banner={banner} active={i === index} compact={compact} />
                </div>

                {banner.reputation ? (
                  <ReputationVisual data={banner.reputation} compact={compact} />
                ) : banner.image ? (
                  <div className={`relative mx-auto w-full ${compact ? "h-40 max-w-[300px] sm:h-56 lg:h-60" : "h-44 max-w-[420px] sm:h-72 lg:h-[330px] lg:max-w-[500px]"}`}>
                    <div className="absolute inset-[12%] rounded-full bg-white/15 blur-3xl" />
                    <div className="absolute inset-x-8 bottom-2 h-8 rounded-full bg-ink-950/20 blur-xl" />
                    <Image
                      src={banner.image.src}
                      alt={banner.image.alt}
                      fill
                      preload={i === 0}
                      sizes={compact ? "(max-width: 639px) 82vw, (max-width: 1023px) 38vw, 300px" : "(max-width: 639px) 86vw, (max-width: 1279px) 42vw, 500px"}
                      className={`object-contain drop-shadow-2xl ${compact ? "p-2 sm:p-3" : "p-2 sm:p-4"}`}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {banners.length > 1 && (
        <>
          <NavButton
            side="left"
            label="Banner anterior"
            compact={compact}
            onClick={() => goTo((index - 1 + banners.length) % banners.length)}
          />
          <NavButton
            side="right"
            label="Próximo banner"
            compact={compact}
            onClick={() => goTo((index + 1) % banners.length)}
          />

          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir para o banner ${i + 1}: ${banner.title}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === index
                    ? "w-7 bg-white"
                    : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function BannerCta({ banner, active, compact }: { banner: Banner; active: boolean; compact: boolean }) {
  const className = `${compact ? "mt-4 rounded-lg px-5 py-2.5 text-xs" : "mt-6 rounded-xl px-6 py-3 text-sm"} inline-flex w-fit items-center gap-2 font-extrabold uppercase tracking-wide shadow-sm transition-transform duration-200 hover:scale-[1.03] active:scale-95 ${banner.theme === "gold" ? "bg-white text-brand-900" : "bg-gold-300 text-brand-950"}`;
  const content = <>{banner.ctaLabel}<span aria-hidden>→</span></>;
  return banner.href.startsWith("http") ? (
    <a href={banner.href} target="_blank" rel="noopener noreferrer" className={className} tabIndex={active ? 0 : -1}>{content}</a>
  ) : (
    <Link href={banner.href} className={className} tabIndex={active ? 0 : -1}>{content}</Link>
  );
}

function ReputationVisual({ data, compact }: { data: NonNullable<Banner["reputation"]>; compact: boolean }) {
  return (
    <div className={`mx-auto grid w-full max-w-[500px] gap-3 border border-white/20 bg-white/95 text-ink-900 shadow-2xl ${compact ? "rounded-2xl p-3" : "rounded-[2rem] p-4 sm:p-6"}`}>
      <p className="text-center text-[11px] font-black uppercase tracking-[0.18em] text-ink-400">Avaliações nos canais oficiais</p>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard brand="Google" rating={data.googleRating} count={data.googleCount} accent="text-[#4285F4]" />
        <MetricCard brand="Shopee" rating={data.shopeeRating} count={data.shopeeCount} accent="text-[#EE4D2D]" />
      </div>
      <p className="text-center text-[10px] text-ink-400">Google em {formatVerifiedDate(data.googleVerifiedAt)} · Shopee em {formatVerifiedDate(data.shopeeVerifiedAt)}</p>
    </div>
  );
}

function MetricCard({ brand, rating, count, accent }: { brand: string; rating: number; count: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-ink-50 p-3 text-center sm:p-5">
      <p className={`text-sm font-black ${accent}`}>{brand}</p>
      <p className="mt-1 text-2xl font-black sm:text-3xl">{rating.toLocaleString("pt-BR", { minimumFractionDigits: brand === "Google" ? 1 : 2 })}</p>
      <p className="text-xs tracking-wider text-gold-500" aria-label={`${rating} de 5 estrelas`}>★★★★★</p>
      <p className="mt-1 text-[10px] font-semibold text-ink-500 sm:text-xs">{count.toLocaleString("pt-BR")} avaliações</p>
    </div>
  );
}

function formatVerifiedDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function NavButton({
  side,
  label,
  onClick,
  compact = false,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute hidden items-center justify-center rounded-full bg-black/25 text-white backdrop-blur transition-colors hover:bg-black/45 lg:flex ${compact ? "bottom-2.5 h-8 w-8" : "top-1/2 h-11 w-11 -translate-y-1/2"} ${
        side === "left" ? (compact ? "left-3" : "left-4") : (compact ? "right-3" : "right-4")
      }`}
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden>
        <path
          d={side === "left" ? "M12.5 4L6.5 10l6 6" : "M7.5 4l6 6-6 6"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
