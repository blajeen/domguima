"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
// Direto de filters.ts, não de queries.ts: queries.ts importa o catálogo
// inteiro (que usa `node:fs` para detectar fotos reais em disco) e isso não
// pode ser puxado para o bundle do cliente.
import { SORT_OPTIONS } from "@/lib/catalog/filters";
import type { SortKey } from "@/lib/catalog/types";

/** Ordenação da vitrine. Também guarda o estado na URL. */
export function SortSelect({ value }: { value: SortKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    const next = event.target.value;
    if (next === "relevancia") params.delete("ordem");
    else params.set("ordem", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      {/* No celular o rótulo some da tela, mas não do leitor de tela: sem ele
          o select ficaria sem nome. */}
      <span className="sr-only whitespace-nowrap text-ink-600 sm:not-sr-only">
        Ordenar por
      </span>
      {/* Mesmo desenho do botão "Filtrar" ao lado: raio de controle, fio de
          1 px e a seta da loja no lugar da seta do sistema. */}
      <span className="relative flex">
        <select
          value={value}
          onChange={onChange}
          className="min-h-11 cursor-pointer appearance-none rounded-control border border-fio bg-white py-2 pl-3.5 pr-9 text-sm font-medium text-grafite-900 transition-colors duration-(--duracao-toque) hover:border-grafite-900"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          name="seta-baixo"
          size={18}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-grafite-700"
        />
      </span>
    </label>
  );
}
