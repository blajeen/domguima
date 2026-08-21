"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Suggestion } from "@/lib/catalog/queries";
import { formatPrice } from "@/lib/utils/format";

/**
 * Busca com sugestões. Procura por nome, categoria, marca e palavras-chave
 * (as tags do produto), então "carregador", "cabo usb" ou "climatização"
 * chegam ao mesmo lugar.
 *
 * Navegação por teclado: ↑ ↓ percorrem, Enter abre, Esc fecha.
 */
export function SearchBar({
  autoFocus = false,
  defaultValue = "",
  className = "",
  compact = false,
}: {
  autoFocus?: boolean;
  defaultValue?: string;
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(defaultValue);
  /** Guardamos o termo junto do resultado para saber a qual busca ele pertence. */
  const [result, setResult] = useState<{ term: string; items: Suggestion[] }>({
    term: "",
    items: [],
  });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const term = query.trim();
  // Derivados do resultado: enquanto o termo do resultado não bate com o que
  // está digitado, a busca ainda está em andamento. Assim não precisamos
  // limpar estado dentro do efeito, e some o resultado velho piscando na tela.
  const suggestions = result.term === term ? result.items : [];
  const loading = term.length >= 2 && result.term !== term;

  // Busca com atraso de 200ms e aborta a anterior — evita resultado fora de ordem.
  useEffect(() => {
    if (term.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sugestoes?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data: { suggestions: Suggestion[] } = await res.json();
        setResult({ term, items: data.suggestions });
        setActiveIndex(-1);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResult({ term, items: [] });
        }
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term]);

  // Fecha ao clicar fora.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      inputRef.current?.blur();
      router.push(href);
    },
    [router],
  );

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!term) return;
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      go(suggestions[activeIndex].href);
      return;
    }
    go(`/busca?q=${encodeURIComponent(term)}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    }
  }

  const showPanel = open && term.length >= 2;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={onSubmit} role="search">
        <label htmlFor={`${listId}-input`} className="sr-only">
          Buscar produtos
        </label>
        <div className={`flex overflow-hidden bg-white shadow-sm ring-1 ring-brand-200 transition-shadow focus-within:ring-2 focus-within:ring-brand-400 ${compact ? "rounded-lg" : "rounded-xl"}`}>
          <input
            ref={inputRef}
            id={`${listId}-input`}
            type="search"
            value={query}
            autoFocus={autoFocus}
            autoComplete="off"
            placeholder="Buscar produtos..."
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
            }
            className={`min-w-0 flex-1 bg-transparent px-4 text-ink-900 outline-none placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden ${compact ? "py-2 text-sm" : "py-2.5 text-[15px]"}`}
          />
          <button
            type="submit"
            aria-label="Buscar"
            className={`m-1 flex shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white transition-colors hover:bg-brand-600 ${compact ? "px-3.5" : "px-4 sm:px-5"}`}
          >
            <SearchIcon className="h-5 w-5" />
          </button>
        </div>
      </form>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          aria-label="Sugestões de busca"
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-xl"
        >
          {loading && suggestions.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-400">Buscando…</p>
          )}

          {!loading && suggestions.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-500">
              Nada encontrado para “{term}”.
            </p>
          )}

          <ul className="max-h-[60vh] overflow-y-auto">
            {suggestions.map((s, i) => (
              <li key={`${s.type}-${s.href}`}>
                <button
                  type="button"
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => go(s.href)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    i === activeIndex ? "bg-gold-50" : "hover:bg-ink-50"
                  }`}
                >
                  {s.type === "produto" && s.image ? (
                    <Image
                      src={s.image}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-md border border-ink-100 object-contain"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-400">
                      <SearchIcon className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2-safe block text-sm text-ink-700">
                      {s.label}
                    </span>
                    {s.type === "categoria" ? (
                      <span className="text-xs text-ink-400">
                        Ver categoria
                      </span>
                    ) : (
                      s.price !== undefined && (
                        <span className="text-xs font-bold text-ink-900">
                          {formatPrice(s.price)}
                        </span>
                      )
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {suggestions.length > 0 && (
            <button
              type="button"
              onClick={() => go(`/busca?q=${encodeURIComponent(term)}`)}
              className="w-full border-t border-ink-100 bg-ink-50 px-4 py-2.5 text-center text-sm font-semibold text-gold-800 transition-colors hover:bg-gold-50"
            >
              Ver todos os resultados para “{term}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M13.5 13.5L17 17"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
