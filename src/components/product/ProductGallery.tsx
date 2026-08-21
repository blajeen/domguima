"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { ProductImage } from "@/lib/catalog/types";

/**
 * Galeria do produto.
 *  - Desktop: miniaturas na lateral e zoom que segue o cursor.
 *  - Mobile: faixa deslizante com snap; o swipe é o nativo do sistema.
 */
export function ProductGallery({ images }: { images: ProductImage[] }) {
  const [active, setActive] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const trackRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) return null;

  const current = images[active];
  const hasMany = images.length > 1;

  function select(index: number) {
    setActive(index);
    const track = trackRef.current;
    const slide = track?.children[index] as HTMLElement | undefined;
    if (track && slide) {
      track.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
    }
  }

  function onMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
  }

  function onTrackScroll() {
    const track = trackRef.current;
    if (!track) return;
    const width = track.clientWidth;
    if (width > 0) setActive(Math.round(track.scrollLeft / width));
  }

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
      {hasMany && (
        <div
          className="flex gap-2 overflow-x-auto sm:w-20 sm:flex-col sm:overflow-visible"
          role="tablist"
          aria-label="Miniaturas do produto"
        >
          {images.map((image, i) => (
            <button
              key={image.src}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Ver imagem ${i + 1} de ${images.length}`}
              onClick={() => select(i)}
              onMouseEnter={() => setActive(i)}
              className={`relative aspect-square w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition-colors sm:w-full ${
                i === active
                  ? "border-gold-400"
                  : "border-ink-100 hover:border-ink-300"
              }`}
            >
              <Image
                src={image.src}
                alt=""
                fill
                sizes="80px"
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}

      <div className="min-w-0 flex-1">
        {/* Desktop: imagem única com zoom */}
        <div
          className="relative hidden aspect-square overflow-hidden rounded-card border border-ink-100 bg-white sm:block"
          onMouseEnter={() => setZooming(true)}
          onMouseLeave={() => setZooming(false)}
          onMouseMove={onMouseMove}
        >
          <Image
            key={current.src}
            src={current.src}
            alt={current.alt}
            fill
            priority
            sizes="(max-width: 1024px) 60vw, 520px"
            style={{ transformOrigin: origin }}
            className={`object-contain p-6 transition-transform duration-200 ${
              zooming ? "scale-[2] cursor-zoom-in" : "scale-100"
            }`}
          />
          {!zooming && (
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-ink-900/70 px-3 py-1 text-[11px] font-medium text-white">
              Passe o mouse para ampliar
            </span>
          )}
        </div>

        {/* Mobile: faixa deslizante */}
        <div className="sm:hidden">
          <div
            ref={trackRef}
            onScroll={onTrackScroll}
            className="scroll-row w-full overflow-hidden rounded-card border border-ink-100 bg-white"
            style={{ gridAutoColumns: "100%" }}
            aria-label="Imagens do produto"
          >
            {images.map((image, i) => (
              <div key={image.src} className="relative aspect-square w-full">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  preload={i === 0}
                  sizes="100vw"
                  className="object-contain p-4"
                />
              </div>
            ))}
          </div>

          {hasMany && (
            <div className="mt-3 flex justify-center gap-1.5">
              {images.map((image, i) => (
                <button
                  key={image.src}
                  type="button"
                  onClick={() => select(i)}
                  aria-label={`Ir para a imagem ${i + 1}`}
                  aria-current={i === active}
                  className={`h-1.5 rounded-full transition-all ${
                    i === active ? "w-6 bg-ink-800" : "w-1.5 bg-ink-300"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
