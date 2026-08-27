/** Comissão por unidade, calculada sobre o preço final praticado. */
export function commissionForUnit(unitPriceCents: number): number {
  if (unitPriceCents <= 2_500) return 100;
  if (unitPriceCents <= 10_000) return 250;
  if (unitPriceCents <= 25_000) return 500;
  if (unitPriceCents <= 100_000) return 1_000;
  return Math.round(unitPriceCents * 0.01);
}
