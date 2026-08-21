"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/utils/format";

export function ExclusiveProductCarousel({ products }: { products: Product[] }) {
  const [index, setIndex] = useState(0);

  if (!products.length) {
    return (
      <section className="flex min-h-[360px] flex-col justify-center rounded-2xl bg-brand-950 p-7 text-white shadow-card">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-300">Exclusivos Dom Guima</p>
        <h2 className="mt-3 text-2xl font-extrabold">Novidades selecionadas pela loja</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">Os próximos produtos exclusivos aparecerão aqui.</p>
      </section>
    );
  }

  const safeIndex = index % products.length;
  const product = products[safeIndex];
  const previous = () => setIndex((current) => (current - 1 + products.length) % products.length);
  const next = () => setIndex((current) => (current + 1) % products.length);

  return (
    <section aria-label="Produtos exclusivos Dom Guima" aria-roledescription="carrossel" className="relative flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-2xl border border-gold-200 bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 bg-brand-950 px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold-300/20 bg-white/5">
            <Image src="/brand/logo-dom-guima.png" alt="" width={32} height={32} className="size-8 object-contain" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gold-300">Linha exclusiva</p>
            <h2 className="truncate text-base font-extrabold">Exclusivos Dom Guima</h2>
          </div>
        </div>
        {products.length > 1 && (
          <div className="flex gap-1.5">
            <ArrowButton label="Produto exclusivo anterior" direction="left" onClick={previous} />
            <ArrowButton label="Próximo produto exclusivo" direction="right" onClick={next} />
          </div>
        )}
      </div>

      <div key={product.id} role="group" aria-label={`${safeIndex + 1} de ${products.length}`} className="flex flex-1 animate-[fade-up_.25s_ease-out] flex-col">
        <Link href={`/produto/${product.slug}`} className="relative mx-4 mt-3 block min-h-0 flex-1 overflow-hidden rounded-xl bg-ink-50">
          <Image
            src={product.images[0].src}
            alt={product.images[0].alt}
            fill
            sizes="(max-width: 1023px) 90vw, 30vw"
            className="object-contain p-3"
          />
          <span className="absolute left-2 top-2 rounded-full bg-gold-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-ink-900">Só na Dom Guima</span>
        </Link>

        <div className="px-4 pb-4 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">{product.brand || "Dom Guima"}</p>
          <Link href={`/produto/${product.slug}`} className="line-clamp-2-safe mt-1 block text-sm font-bold leading-snug text-ink-800 hover:text-gold-800">{product.name}</Link>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              {product.oldPrice && <p className="text-[10px] text-ink-400 line-through">{formatPrice(product.oldPrice)}</p>}
              <p className="text-lg font-black text-ink-950">{formatPrice(product.price)}</p>
            </div>
            <Link href={`/produto/${product.slug}`} className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-extrabold text-white transition-colors hover:bg-brand-600">Ver produto</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ArrowButton({ label, direction, onClick }: { label: string; direction: "left" | "right"; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/10 transition-colors hover:bg-white/20">
      <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden>
        <path d={direction === "left" ? "M12.5 4L6.5 10l6 6" : "M7.5 4l6 6-6 6"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
