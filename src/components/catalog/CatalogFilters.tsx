"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useId,
  useMemo,
  useOptimistic,
  useState,
} from "react";
import { Button, chipStyles, textLinkStyles } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import {
  parseFilterState,
  parsePriceRange,
  type FilterState,
  type PriceRange,
} from "@/lib/catalog/filters";

/**
 * Filtros da vitrine, em três peças que dividem o mesmo estado:
 *
 *   <FilterSidebar />  barra lateral do desktop
 *   <FilterTrigger />  botão "Filtrar" do mobile — mora na barra de ordenação
 *   <FilterDrawer />   gaveta do mobile
 *
 * São separados porque o botão do mobile precisa ficar ao lado do "Ordenar por",
 * dentro da coluna de produtos. Quando ele era irmão do grid no flex de duas
 * colunas, roubava largura no celular e estourava a página na horizontal.
 *
 * O estado dos filtros mora na URL: o link filtrado pode ser compartilhado,
 * o botão "voltar" funciona e a página continua indexável.
 */

interface FiltersContextValue {
  brands: string[];
  priceRanges: PriceRange[];
  state: FilterState;
  resultCount: number;
  hideOfferFilter: boolean;
  activeCount: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Sem id, volta para "Qualquer preço". */
  setPrice: (id?: string) => void;
  toggleBrand: (brand: string) => void;
  toggleFlag: (key: "promo" | "disponivel", current: boolean) => void;
  clearAll: () => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("Use os filtros dentro de <CatalogFiltersProvider>.");
  return ctx;
}

export function CatalogFiltersProvider({
  brands,
  priceRanges,
  state,
  resultCount,
  hideOfferFilter = false,
  children,
}: {
  brands: string[];
  /** Faixas tiradas dos preços da listagem (`priceRangesFor`). */
  priceRanges: PriceRange[];
  state: FilterState;
  resultCount: number;
  hideOfferFilter?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // A URL só muda quando a navegação termina. Até lá, rádios e caixas mostram
  // a escolha nova: sem isto o React devolve o `checked` antigo, e com as
  // setas do teclado o rádio em foco aparecia (e era lido) como desmarcado.
  const [filtros, setFiltrosOtimistas] = useOptimistic(state);

  const apply = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("pagina"); // Mudou o filtro, volta para a primeira página.
      const qs = params.toString();
      startTransition(() => {
        setFiltrosOtimistas(parseFilterState(paramsComoRegistro(params)));
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams, setFiltrosOtimistas],
  );

  const value = useMemo<FiltersContextValue>(() => {
    const activeCount =
      (filtros.price ? 1 : 0) +
      filtros.brands.length +
      (filtros.onlyOffers ? 1 : 0) +
      (filtros.onlyInStock ? 1 : 0);

    return {
      brands,
      priceRanges,
      state: filtros,
      resultCount,
      hideOfferFilter,
      activeCount,
      open,
      setOpen,
      setPrice: (id) => apply((p) => (id ? p.set("preco", id) : p.delete("preco"))),
      toggleBrand: (brand) =>
        apply((p) => {
          const next = filtros.brands.includes(brand)
            ? filtros.brands.filter((b) => b !== brand)
            : [...filtros.brands, brand];
          p.delete("marca");
          next.forEach((b) => p.append("marca", b));
        }),
      toggleFlag: (key, current) =>
        apply((p) => (current ? p.delete(key) : p.set(key, "1"))),
      clearAll: () =>
        apply((p) => {
          p.delete("preco");
          p.delete("marca");
          p.delete("promo");
          p.delete("disponivel");
        }),
    };
  }, [brands, priceRanges, filtros, resultCount, hideOfferFilter, open, apply]);

  return (
    <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
  );
}

/** URLSearchParams no formato dos searchParams da rota, para `parseFilterState`. */
function paramsComoRegistro(params: URLSearchParams): Record<string, string | string[]> {
  const registro: Record<string, string | string[]> = {};
  for (const chave of new Set(params.keys())) {
    const valores = params.getAll(chave);
    registro[chave] = valores.length > 1 ? valores : valores[0];
  }
  return registro;
}

function FilterBody() {
  const {
    brands,
    priceRanges,
    state,
    hideOfferFilter,
    activeCount,
    setPrice,
    toggleBrand,
    toggleFlag,
    clearAll,
  } = useFilters();
  // Nome próprio por instância: a lateral e a gaveta montam este mesmo corpo,
  // e rádios com o mesmo nome virariam um grupo só na página.
  const grupoPreco = useId();

  // A faixa marcada pode não estar entre as da listagem (link compartilhado
  // antes de os preços mudarem): ela aparece assim mesmo, para dar para trocar.
  const marcada = parsePriceRange(state.price);
  const faixas =
    marcada && !priceRanges.some((range) => range.id === marcada.id)
      ? [marcada, ...priceRanges]
      : priceRanges;

  return (
    <div className="space-y-6">
      {activeCount > 0 && (
        <button type="button" onClick={clearAll} className={`${textLinkStyles} -mt-2.5`}>
          Limpar filtros ({activeCount})
        </button>
      )}

      {faixas.length > 0 && (
        <Group title="Preço">
          <Check
            type="radio"
            name={grupoPreco}
            checked={!state.price}
            onChange={() => setPrice()}
            label="Qualquer preço"
          />
          {faixas.map((range) => (
            <Check
              key={range.id}
              type="radio"
              name={grupoPreco}
              checked={state.price === range.id}
              onChange={() => setPrice(range.id)}
              label={range.label}
            />
          ))}
        </Group>
      )}

      {brands.length > 0 && (
        <Group title="Marca">
          {brands.map((brand) => (
            <Check
              key={brand}
              type="checkbox"
              checked={state.brands.includes(brand)}
              onChange={() => toggleBrand(brand)}
              label={brand}
            />
          ))}
        </Group>
      )}

      <Group title="Outros">
        {!hideOfferFilter && (
          <Check
            type="checkbox"
            checked={state.onlyOffers}
            onChange={() => toggleFlag("promo", state.onlyOffers)}
            label="Somente promoções"
          />
        )}
        <Check
          type="checkbox"
          checked={state.onlyInStock}
          onChange={() => toggleFlag("disponivel", state.onlyInStock)}
          label="Somente disponíveis"
        />
      </Group>
    </div>
  );
}

/**
 * Barra lateral — só no desktop. Presa abaixo do header; se os filtros forem
 * mais altos que a tela (muitas marcas), rola por dentro.
 */
export function FilterSidebar() {
  return (
    <aside aria-label="Filtros" className="hidden w-56 shrink-0 lg:block xl:w-64">
      <div className="sticky top-[calc(var(--header-h)+1.5rem)] max-h-[calc(100dvh-var(--header-h)-3rem)] overflow-y-auto overscroll-contain rounded-card border border-fio bg-white p-5">
        <p className="mb-4 text-base font-bold text-grafite-900">Filtrar</p>
        <FilterBody />
      </div>
    </aside>
  );
}

/** Botão do mobile — fica ao lado do seletor de ordenação, com o mesmo desenho. */
export function FilterTrigger() {
  const { setOpen, activeCount } = useFilters();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`${chipStyles} shrink-0 lg:hidden`}
    >
      <Icon name="filtro" size={18} />
      Filtrar
      {activeCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-grafite-900 px-1 text-xs font-bold tabular-nums text-papel">
          {activeCount}
          <span className="sr-only"> {activeCount === 1 ? "filtro ativo" : "filtros ativos"}</span>
        </span>
      )}
    </button>
  );
}

/** Gaveta do mobile. Fica fora do fluxo, então não afeta o layout. */
export function FilterDrawer() {
  const { open, setOpen, resultCount } = useFilters();

  return (
    <div className="lg:hidden">
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Filtrar"
        side="left"
        footer={
          <Button onClick={() => setOpen(false)} fullWidth>
            Ver {resultCount} {resultCount === 1 ? "produto" : "produtos"}
          </Button>
        }
      >
        <div className="p-4">
          <FilterBody />
        </div>
      </Drawer>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-bold text-grafite-900">{title}</legend>
      <div className="space-y-0.5">{children}</div>
    </fieldset>
  );
}

/**
 * Caixa de seleção e rádio da loja: quadrado de canto quase reto (rádio
 * redondo), fio de 1 px e grafite quando marcado. O input nativo continua
 * lá (teclado, leitor de tela, foco); só a aparência é desenhada.
 */
function Check({
  type,
  name,
  checked,
  onChange,
  label,
}: {
  type: "radio" | "checkbox";
  name?: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="group/opcao flex min-h-9 cursor-pointer items-center gap-3 text-sm text-ink-700 transition-colors duration-(--duracao-toque) hover:text-grafite-900 pointer-coarse:min-h-11">
      <span className="relative flex size-5 shrink-0 items-center justify-center">
        <input
          type={type}
          name={name}
          checked={checked}
          onChange={onChange}
          // ink-400 no contorno: 4:1 sobre branco, acima dos 3:1 de controle.
          className={`peer absolute inset-0 m-0 cursor-pointer appearance-none border border-ink-400 bg-white transition-colors duration-(--duracao-toque) checked:border-grafite-900 checked:bg-grafite-900 group-hover/opcao:border-grafite-900 ${
            type === "radio" ? "rounded-pill" : "rounded-card"
          }`}
        />
        {type === "checkbox" ? (
          // Exceção ao traço do conjunto, de propósito: o 1,75 é na grade de
          // 24 px; com o ícone em 14 px ele viraria um fio de 1 px, e 2,5 dá
          // ~1,5 px, o peso que os outros ícones têm no tamanho normal.
          <Icon
            name="check"
            size={14}
            strokeWidth={2.5}
            className="pointer-events-none relative text-papel opacity-0 peer-checked:opacity-100"
          />
        ) : (
          <span className="pointer-events-none relative size-2 rounded-pill bg-papel opacity-0 peer-checked:opacity-100" />
        )}
      </span>
      {label}
    </label>
  );
}
