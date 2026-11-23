import { normalize } from "@/lib/utils/format";
import type { Product } from "./types";

const voltagePattern = /\b(?:(110|127|220)\s*(?:v|volts?)|bivolt)\b/g;

function voltageKey(match: RegExpMatchArray): string {
  // O catálogo usa 110V no seletor e 127V na ficha de alguns produtos.
  return match[1] === "110" ? "127" : match[1] ?? "bivolt";
}

export function parseVoltageSearch(query: string) {
  const normalized = normalize(query);
  const voltages = new Set(Array.from(normalized.matchAll(voltagePattern), voltageKey));
  const terms = normalized.replace(voltagePattern, " ").split(/\s+/).filter(Boolean);
  return { terms, voltages };
}

function isVoltageLabel(label: string): boolean {
  return /^(?:voltagem|tensao)\b/.test(normalize(label));
}

function readVoltages(values: string[]): string[] {
  return values.flatMap((value) =>
    Array.from(normalize(value).matchAll(voltagePattern), voltageKey),
  );
}

export function matchesVoltage(product: Product, requested: ReadonlySet<string>): boolean {
  const isAvailableIn = (available: string[]) => available.some((voltage) =>
    requested.has(voltage) || (voltage === "bivolt" && (requested.has("127") || requested.has("220"))),
  );

  if (product.variantAxis && isVoltageLabel(product.variantAxis)) {
    // Uma ficha antiga pode mencionar uma opção que já saiu de estoque.
    const inStock = product.variantOptions?.filter((option) => option.stock > 0) ?? [];
    return isAvailableIn(readVoltages(inStock.map((option) => option.label)));
  }

  const registered = readVoltages([
    ...(product.variants ?? []).filter((variant) => isVoltageLabel(variant.name)).flatMap((variant) => variant.options),
    ...product.specifications.filter((spec) => isVoltageLabel(spec.label)).map((spec) => spec.value),
  ]);
  return isAvailableIn(registered.length ? registered : readVoltages([product.name]));
}
