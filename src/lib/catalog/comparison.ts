/** Keep similar product types together, even when a broad category mixes TVs and soundbars. */
export function comparisonGroup(name: string, categoryId: string): string | null {
  const text = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/suporte|controle remoto|pelicula|capa para/.test(text)) return null;
  const families = [
    ["tv", /\bsmart tv\b|\btv\b|televisor/], ["soundbar", /soundbar/],
    ["refrigerador", /refrigerador|geladeira/], ["microondas", /micro.?ondas/],
    ["airfryer", /air ?fryer|fritadeira/], ["liquidificador", /liquidificador/],
    ["purificador", /purificador de agua/], ["lavadora", /lavadora|lava e seca|maquina de lavar/],
    ["ventilador", /ventilador|vent\.mesa/], ["ar-condicionado", /ar condicionado/],
    ["aspirador", /aspirador/], ["cafeteira", /cafeteira/], ["mixer", /mixer/],
    ["celular", /smartphone|celular/], ["notebook", /notebook/], ["monitor", /monitor/],
  ] as const;
  const family = families.find(([, pattern]) => pattern.test(text));
  return family ? `${categoryId}:${family[0]}` : null;
}
