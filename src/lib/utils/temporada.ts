export type Temporada = "natal" | "virada" | "pascoa" | "maes" | "pais";

const DIA_MS = 86_400_000;
const dia = (ano: number, mes: number, d: number) => Date.UTC(ano, mes - 1, d) / DIA_MS;

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number): number {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), diaDoMes = ((h + l - 7 * m + 114) % 31) + 1;
  return dia(ano, mes, diaDoMes);
}

/** 2º domingo do mês (Dia das Mães em maio, Dia dos Pais em agosto, no Brasil). */
export function segundoDomingo(ano: number, mes: number): number {
  const primeiro = dia(ano, mes, 1);
  const semana = new Date(primeiro * DIA_MS).getUTCDay();
  return primeiro + ((7 - semana) % 7) + 7;
}

/** Quantos dias antes da data a campanha começa (Páscoa, Mães, Pais). */
const ANTECEDENCIA = 14;

/**
 * Tema do site, todo ano sozinho, pela data de São Paulo:
 * Páscoa, Dia das Mães e Dia dos Pais nos 14 dias até a data;
 * Natal de 1º a 25/12; Virada de 26/12 a 9/1; o resto do ano, normal.
 */
export function temporadaEm(data: Date): Temporada | null {
  const [ano, mes, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(data).split("-").map(Number);
  if (mes === 12) return d <= 25 ? "natal" : "virada";
  if (mes === 1 && d <= 9) return "virada";
  const hoje = dia(ano, mes, d);
  const naJanela = (alvo: number) => hoje >= alvo - ANTECEDENCIA && hoje <= alvo;
  // Páscoa antes das Mães: numa Páscoa tardia as duas janelas se encostam.
  if (naJanela(pascoa(ano))) return "pascoa";
  if (naJanela(segundoDomingo(ano, 5))) return "maes";
  if (naJanela(segundoDomingo(ano, 8))) return "pais";
  return null;
}

export const TEMPORADAS: Record<Temporada, { titulo: string; frase: string; emoji: string; enfeites: string[] }> = {
  natal: { titulo: "Natal de Ofertas", frase: "O presente certo, com preço de verdade e entrega em Uberlândia", emoji: "🎁", enfeites: ["❄", "❄", "🎁", "❄", "⭐", "❄"] },
  virada: { titulo: "Virada de Ofertas", frase: "Feliz Ano Novo! Comece o ano com desconto", emoji: "🥂", enfeites: [] },
  pascoa: { titulo: "Páscoa de Ofertas", frase: "Presentes que valem mais que chocolate", emoji: "🐰", enfeites: ["🥚", "🐰", "🍫", "🥚"] },
  maes: { titulo: "Dia das Mães de Ofertas", frase: "O presente para quem sempre cuidou de você", emoji: "💐", enfeites: ["🌸", "💗", "🌷", "🌸"] },
  pais: { titulo: "Dia dos Pais de Ofertas", frase: "Ferramentas, eletrônicos e presentes que ele vai usar todo dia", emoji: "👔", enfeites: ["⭐", "🎁", "⭐", "🔧"] },
};

export const TEMAS = Object.keys(TEMPORADAS) as Temporada[];
