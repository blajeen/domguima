"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PriceTag } from "@/components/ui/PriceTag";
import { useVidroParado } from "@/components/ui/useVidroParado";
import { categoryIcon } from "@/lib/catalog/categories";
import type { Suggestion } from "@/lib/catalog/queries";

/**
 * Busca com sugestões. Procura por nome, categoria, marca e palavras-chave
 * (as tags do produto), então "carregador", "cabo usb" ou "climatização"
 * chegam ao mesmo lugar.
 *
 * Campo branco de 44 px no header grafite. As sugestões abrem num painel de
 * vidro claro bem opaco sobre a página, com o preço-assinatura.
 *
 * Navegação por teclado: ↑ ↓ percorrem, Enter abre, Esc fecha.
 */
export function SearchBar({
  autoFocus = false,
  defaultValue = "",
  className = "",
}: {
  autoFocus?: boolean;
  defaultValue?: string;
  className?: string;
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
  // O combobox só se diz expandido com opções na lista. Sem elas, o painel
  // mostra só o estado, que o leitor de tela ouve pela região viva.
  const temOpcoes = showPanel && suggestions.length > 0;
  const [vidro, aoTerminarTransicao] = useVidroParado(showPanel);
  // Texto de estado do painel ("Buscando…" ou nada encontrado), quando não há
  // opção para mostrar.
  const estado =
    showPanel && suggestions.length === 0
      ? loading
        ? "Buscando…"
        : `Nada encontrado para “${term}”.`
      : "";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={onSubmit} role="search">
        <label htmlFor={`${listId}-input`} className="sr-only">
          Buscar produtos
        </label>
        {/* Foco no contorno do campo inteiro, em ouro-claro: 9,4:1 no
            grafite e 4,9:1 no vidro do header. */}
        <div className="flex h-11 overflow-hidden rounded-control bg-white focus-within:ring-2 focus-within:ring-ouro-claro">
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
            aria-expanded={temOpcoes}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
            }
            // 16 px: abaixo disso o Safari do iPhone dá zoom na página ao focar.
            className="min-w-0 flex-1 bg-transparent px-4 text-base text-grafite-900 outline-none placeholder:text-ink-500 [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            type="submit"
            aria-label="Buscar"
            // Foco grafite: o anel dele fica sobre o branco do campo, onde o
            // ouro-claro do header some. O ::after estende o toque pela margem
            // até a altura do campo (44 px); o desenho continua recuado.
            className="relative m-1 flex shrink-0 items-center justify-center rounded-control bg-grafite-900 px-4 text-papel transition-colors duration-(--duracao-toque) after:absolute after:-inset-1 hover:bg-grafite-800 focus-visible:outline-grafite-900 sm:px-5"
          >
            <Icon name="busca" />
          </button>
        </div>
      </form>

      {/* O estado da busca para o leitor de tela. A região viva fica sempre na
          página: montada junto com o texto, como o painel, não seria anunciada. */}
      <p role="status" className="sr-only">
        {estado}
      </p>

      {showPanel && (
        <div
          onTransitionEnd={aoTerminarTransicao}
          // Vidro claro. Entra só na opacidade, com @starting-style, ainda
          // sólido, e vira vidro parado (useVidroParado). Cor de texto e de
          // foco próprias: o painel mora dentro do header, que usa papel e
          // ouro-claro.
          className={`${vidro ? "glass-light" : "bg-white/96"} absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-card border border-fio text-grafite-900 shadow-float transition-opacity duration-(--duracao-entrada) ease-out [--cor-foco:var(--color-gold-600)] starting:opacity-0`}
        >
          {/* O leitor de tela já ouviu este texto pela região viva acima. */}
          {estado && (
            <p aria-hidden className="px-4 py-3 text-sm text-ink-600">
              {estado}
            </p>
          )}

          {/* Só opções dentro do listbox, e ele só existe com opções: o texto
              de estado e o "Ver todos" ficam fora dele. */}
          {temOpcoes && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Sugestões de busca"
              className="max-h-[60vh] overflow-y-auto overscroll-contain"
            >
              {suggestions.map((s, i) => (
                <li key={`${s.type}-${s.href}`} role="presentation">
                  <button
                    type="button"
                    id={`${listId}-opt-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => go(s.href)}
                    // A opção ativa (mouse ou setas) ganha o fundo papel e um fio
                    // de ouro à esquerda.
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-(--duracao-toque) ${
                      i === activeIndex ? "bg-papel shadow-[inset_2px_0_0_var(--color-ouro)]" : ""
                    }`}
                  >
                    {s.type === "produto" && s.image ? (
                      <Image
                        src={s.image}
                        alt=""
                        width={44}
                        height={44}
                        className="size-11 shrink-0 rounded-card border border-fio bg-white object-contain p-0.5"
                      />
                    ) : (
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-card border border-fio bg-white text-ink-500">
                        <Icon name={s.type === "categoria" ? iconeDaCategoria(s.href) : "busca"} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2-safe block text-sm text-grafite-900">
                        {s.label}
                      </span>
                      {s.type === "categoria" && (
                        <span className="text-xs text-ink-600">Ver categoria</span>
                      )}
                    </span>
                    {s.type === "produto" && s.price !== undefined && (
                      <PriceTag cents={s.price} size="compacto" className="shrink-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {temOpcoes && (
            <button
              type="button"
              onClick={() => go(`/busca?q=${encodeURIComponent(term)}`)}
              className="flex min-h-11 w-full items-center justify-center border-t border-fio px-4 text-center text-sm font-semibold text-grafite-900 underline decoration-ouro underline-offset-4 transition-colors duration-(--duracao-toque) hover:bg-papel"
            >
              Ver todos os resultados para “{term}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A sugestão de categoria traz só o link (/categoria/<slug>): o ícone sai do slug. */
function iconeDaCategoria(href: string): IconName {
  const slug = href.slice(href.lastIndexOf("/") + 1);
  return categoryIcon({ slug, id: slug });
}
