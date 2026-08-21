"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Drawer } from "@/components/ui/Drawer";
import { PRICE_RANGES, type FilterState } from "@/lib/catalog/filters";

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
  state: FilterState;
  resultCount: number;
  hideOfferFilter: boolean;
  activeCount: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  setPrice: (id: string) => void;
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
  state,
  resultCount,
  hideOfferFilter = false,
  children,
}: {
  brands: string[];
  state: FilterState;
  resultCount: number;
  hideOfferFilter?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const apply = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("pagina"); // Mudou o filtro, volta para a primeira página.
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const value = useMemo<FiltersContextValue>(() => {
    const activeCount =
      (state.price ? 1 : 0) +
      state.brands.length +
      (state.onlyOffers ? 1 : 0) +
      (state.onlyInStock ? 1 : 0);

    return {
      brands,
      state,
      resultCount,
      hideOfferFilter,
      activeCount,
      open,
      setOpen,
      setPrice: (id) =>
        apply((p) => (state.price === id ? p.delete("preco") : p.set("preco", id))),
      toggleBrand: (brand) =>
        apply((p) => {
          const next = state.brands.includes(brand)
            ? state.brands.filter((b) => b !== brand)
            : [...state.brands, brand];
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
  }, [brands, state, resultCount, hideOfferFilter, open, apply]);

  return (
    <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
  );
}

function FilterBody() {
  const {
    brands,
    state,
    hideOfferFilter,
    activeCount,
    setPrice,
    toggleBrand,
    toggleFlag,
    clearAll,
  } = useFilters();

  return (
    <div className="space-y-6">
      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="text-sm font-semibold text-promo underline-offset-2 hover:underline"
        >
          Limpar filtros ({activeCount})
        </button>
      )}

      <Group title="Preço">
        {PRICE_RANGES.map((range) => (
          <Check
            key={range.id}
            type="radio"
            checked={state.price === range.id}
            onChange={() => setPrice(range.id)}
            label={range.label}
          />
        ))}
      </Group>

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

/** Barra lateral — só no desktop. */
export function FilterSidebar() {
  return (
    <aside aria-label="Filtros" className="hidden w-56 shrink-0 lg:block xl:w-64">
      <div className="sticky top-44 rounded-card border border-ink-100 bg-white p-5 shadow-card">
        <p className="mb-4 text-sm font-extrabold uppercase tracking-wider text-ink-900">
          Filtrar
        </p>
        <FilterBody />
      </div>
    </aside>
  );
}

/** Botão do mobile — fica ao lado do seletor de ordenação. */
export function FilterTrigger() {
  const { setOpen, activeCount } = useFilters();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex shrink-0 items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 lg:hidden"
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <path
          d="M3 5h14M6 10h8M8.5 15h3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      Filtrar
      {activeCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1 text-[11px] font-extrabold text-ink-900">
          {activeCount}
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
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-extrabold text-white"
          >
            Ver {resultCount} {resultCount === 1 ? "produto" : "produtos"}
          </button>
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
      <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">
        {title}
      </legend>
      <div className="space-y-1.5">{children}</div>
    </fieldset>
  );
}

function Check({
  type,
  checked,
  onChange,
  label,
}: {
  type: "radio" | "checkbox";
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-600 transition-colors hover:text-ink-900">
      <input
        type={type}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-gold-500"
      />
      {label}
    </label>
  );
}
