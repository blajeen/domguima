// Postagens planejadas no calendário da aba Conteúdo. Moram no JSONB privado
// de store_settings (operations.postagens), como a venda para lojistas: sem
// migration, e o modo local em arquivo funciona igual.
import { FORMATOS, type FormatoExemplo } from "./exemplosConteudo";

export type StatusPostagem = "planejado" | "publicado";

export interface PostagemPlanejada {
  id: string;
  /** "AAAA-MM-DD", no fuso da loja. */
  dia: string;
  /** "HH:MM"; vazio = sem hora definida. */
  hora: string;
  formato: FormatoExemplo;
  titulo: string;
  legenda: string;
  /** Caminho em public ("/brand/...") ou URL https da arte. */
  imagem: string;
  status: StatusPostagem;
  /** Link do post publicado no Instagram. */
  link: string;
}

/** Limite de legenda do Instagram. */
export const LEGENDA_MAX = 2200;
export const TITULO_MAX = 80;

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const imagemValida = (v: string) => v === "" || (/^\/[\w\-./]+$/.test(v) && !v.includes("..")) || /^https:\/\/\S+$/.test(v);
const linkValido = (v: string) => v === "" || /^https:\/\/\S+$/.test(v);

/** Valida o que veio do formulário. Devolve a postagem ou a mensagem de erro. */
export function lerPostagem(campos: Record<string, string>, id: string): PostagemPlanejada | string {
  const p: PostagemPlanejada = {
    id,
    dia: campos.dia?.trim() ?? "",
    hora: campos.hora?.trim() ?? "",
    formato: campos.formato as FormatoExemplo,
    titulo: (campos.titulo ?? "").trim(),
    // A textarea manda \r\n; o Instagram conta 1 caractere por quebra.
    legenda: (campos.legenda ?? "").replace(/\r\n?/g, "\n").trim(),
    imagem: (campos.imagem ?? "").trim(),
    status: campos.status === "publicado" ? "publicado" : "planejado",
    link: (campos.link ?? "").trim(),
  };
  if (!DIA.test(p.dia) || Number.isNaN(Date.parse(`${p.dia}T00:00:00Z`))) return "Escolha o dia da postagem.";
  if (p.hora && !HORA.test(p.hora)) return "Hora inválida. Use o formato 18:30.";
  if (!(p.formato in FORMATOS)) return "Escolha o formato.";
  if (!p.titulo) return "Dê um título para achar o post no calendário.";
  if (p.titulo.length > TITULO_MAX) return `O título pode ter até ${TITULO_MAX} caracteres.`;
  if ([...p.legenda].length > LEGENDA_MAX) return `A legenda passa do limite do Instagram (${LEGENDA_MAX} caracteres).`;
  if (!imagemValida(p.imagem)) return "A imagem precisa ser um arquivo do site (/brand/...) ou um link https.";
  if (!linkValido(p.link)) return "O link do post precisa começar com https://.";
  return p;
}

/** Lê o que está gravado; registro estragado é descartado em vez de quebrar o painel. */
export function normalizarPostagens(value: unknown): PostagemPlanejada[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || typeof (item as { id?: unknown }).id !== "string") return [];
    const campos = Object.fromEntries(Object.entries(item).map(([k, v]) => [k, typeof v === "string" ? v : ""]));
    const p = lerPostagem(campos, (item as { id: string }).id);
    return typeof p === "string" ? [] : [p];
  });
}
