"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
      <span className="hidden whitespace-nowrap text-ink-500 sm:inline">
        Ordenar por
      </span>
      <select
        value={value}
        onChange={onChange}
        className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 outline-none transition-colors hover:border-ink-300 focus:border-gold-400"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
