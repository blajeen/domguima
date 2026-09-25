/**
 * Venda para lojistas: a tabela de preços que a Dom Guima passa para outras
 * lojas, só da conta principal (domguima).
 *
 * "faz uma função no painel ... para vender para outra loja e que so o
 * domguima pode ver, nessa aba ele escolhe uma % de desconto e gera uma
 * catalogo ... com todos os produtos do estoque dele com 10% de desconto e
 * tambem coloca opção dele alterar um produto em especifico ... pra caso
 * queira abaixar o preço mais ainda" (25/09/2026).
 *
 * O preço de lojista é derivado: sai do preço à vista do produto (ou da
 * opção) menos o desconto, calculado na leitura. Só se grava o que o dono
 * decide: o desconto, as condições e o preço especial de cada linha. Mudou o
 * preço no cadastro, o preço de lojista acompanha; o especial fica, e a tela
 * avisa quando ele passou a ficar acima do novo preço à vista.
 *
 * Sem "server-only" e sem zod: o mesmo módulo valida no navegador (antes do
 * envio) e na action, e monta as linhas no painel e no PDF.
 */
import type { AdminProductRow } from "./types";

/** Desconto padrão pedido pelo dono. */
export const DESCONTO_LOJISTA_PADRAO = 10;
/** Teto do desconto geral: acima disso é quase dar o produto, e erro de digitação vira prejuízo. */
export const DESCONTO_LOJISTA_MAXIMO = 90;
export const CONDICOES_LOJISTA_MAXIMO = 400;

/** O que o dono decide na aba (fica no JSONB privado de store_settings). */
export interface VendaLojistas {
  /** Desconto sobre o preço à vista, em %, de 0 a 90, com até uma casa decimal. */
  descontoPercent: number;
  /** Texto curto das condições, no rodapé do catálogo (pedido mínimo, pagamento...). Vazio: não aparece. */
  condicoes: string;
  /**
   * Preço especial por linha, em centavos. A chave é o id do produto, ou
   * "produto::opção" quando ele tem variações. Substitui o desconto só
   * naquela linha.
   */
  precos: Record<string, number>;
  /**
   * Mostrar o preço à vista do site ao lado do preço para lojista no
   * catálogo. Nasce desligado: o pedido era um catálogo simples, e mostrar o
   * preço de varejo a outra loja é decisão comercial do dono.
   */
  mostrarPrecoSite: boolean;
}

export const VENDA_LOJISTAS_PADRAO: VendaLojistas = { descontoPercent: DESCONTO_LOJISTA_PADRAO, condicoes: "", precos: {}, mostrarPrecoSite: false };

/** Registro gravado antes (ou torto) vira o padrão, campo a campo. */
export function normalizarVendaLojistas(valor: unknown): VendaLojistas {
  const v = (valor && typeof valor === "object" ? valor : {}) as Partial<Record<keyof VendaLojistas, unknown>>;
  const desconto = typeof v.descontoPercent === "number" && v.descontoPercent >= 0 && v.descontoPercent <= DESCONTO_LOJISTA_MAXIMO
    ? Math.round(v.descontoPercent * 10) / 10
    : DESCONTO_LOJISTA_PADRAO;
  const precos: Record<string, number> = {};
  if (v.precos && typeof v.precos === "object") {
    for (const [chave, cents] of Object.entries(v.precos as Record<string, unknown>)) {
      if (typeof cents === "number" && Number.isInteger(cents) && cents > 0) precos[chave] = cents;
    }
  }
  return {
    descontoPercent: desconto,
    condicoes: typeof v.condicoes === "string" ? v.condicoes.slice(0, CONDICOES_LOJISTA_MAXIMO) : "",
    precos,
    mostrarPrecoSite: v.mostrarPrecoSite === true,
  };
}

/** "10", "7,5", "12.5%" → número; o resto → null. De 0 a 90, com até uma casa. */
export function lerDescontoDigitado(texto: string): number | null {
  const achado = texto.trim().match(/^(\d{1,2})(?:[.,](\d))?\s*%?$/);
  if (!achado) return null;
  const valor = Number(`${achado[1]}.${achado[2] ?? "0"}`);
  return valor <= DESCONTO_LOJISTA_MAXIMO ? valor : null;
}

/** "89,90", "1.234,56", "R$ 12,5", "40" → centavos; o resto → null. */
export function lerDinheiroDigitado(texto: string): number | null {
  const limpo = texto.replace(/R\$/i, "").replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  // Com vírgula, o ponto é de milhar; sem vírgula, um ponto seguido de 1 ou 2
  // dígitos é decimal ("12.5"), e com 3 é milhar ("1.234").
  const normal = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : /\.\d{3}$/.test(limpo) ? limpo.replace(/\./g, "") : limpo;
  const cents = Math.round(Number(normal) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

export type ResultadoPrecoEspecial = { ok: true; cents: number | null } | { ok: false; mensagem: string };

/**
 * Preço especial digitado para uma linha. Vazio = tirar o preço especial.
 * O especial é para baixar mais que o desconto geral ("abaixar o preço mais
 * ainda", dono): precisa ficar abaixo do preço com o desconto geral da linha.
 * Um especial acima dele faria o lojista pagar mais justo no item marcado
 * como especial.
 */
export function validarPrecoEspecial(texto: string, comDescontoCents: number): ResultadoPrecoEspecial {
  if (!texto.trim()) return { ok: true, cents: null };
  const cents = lerDinheiroDigitado(texto);
  if (cents === null) return { ok: false, mensagem: "Digite o preço em reais, como 89,90." };
  if (cents >= comDescontoCents) return { ok: false, mensagem: `Para baixar mais, fique abaixo de ${formatarReais(comDescontoCents)} (o preço com o desconto geral).` };
  return { ok: true, cents };
}

/** Quanto um preço dá de desconto sobre o preço à vista, em % inteiro: pega erro de digitação ("1,99" em vez de "199"). */
export function descontoEquivalente(cents: number, varejoCents: number): number {
  return varejoCents > 0 ? Math.round((1 - cents / varejoCents) * 100) : 0;
}

function formatarReais(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Preço com o desconto geral, arredondado para o centavo mais próximo. */
export function precoComDesconto(varejoCents: number, descontoPercent: number): number {
  return Math.round(varejoCents * (1 - descontoPercent / 100));
}

export interface LinhaLojista {
  /** id do produto, ou "produto::opção". É a chave de `VendaLojistas.precos`. */
  chave: string;
  produtoId: string;
  nome: string;
  /** Rótulo da opção ("Preto", "220V"); null em produto sem variação. */
  opcao: string | null;
  sku: string;
  categoria: string;
  estoque: number;
  /** Preço à vista do site. */
  varejoCents: number;
  /** Com o desconto geral. */
  comDescontoCents: number;
  /** Preço especial gravado para a linha, ou null. */
  especialCents: number | null;
  /**
   * O especial gravado não está abaixo do preço com o desconto geral (o
   * desconto subiu ou o preço do cadastro baixou depois): ele não vale, a
   * linha fica com o desconto geral (o menor) e o painel avisa até o dono
   * corrigir.
   */
  especialSemEfeito: boolean;
  /** O que o catálogo mostra: o especial válido ou o com desconto. */
  finalCents: number;
}

/**
 * Todas as linhas do catálogo: todo produto PUBLICADO com estoque, uma linha
 * por opção com estoque quando há variações ativas (cada uma com o próprio
 * preço). Só publicado, a mesma regra da vitrine e do Catálogo PDF: rascunho
 * não está no site, pode estar incompleto, e não tem "preço no site" para
 * mostrar. Ordem: categoria, nome, opção.
 */
export function linhasParaLojistas(produtos: readonly AdminProductRow[], venda: VendaLojistas): LinhaLojista[] {
  const linhas: LinhaLojista[] = [];
  for (const produto of produtos) {
    if (produto.status !== "active") continue;
    const categoria = produto.categories?.name ?? produto.category_id;
    const opcoes = (produto.product_variants ?? []).filter((opcao) => opcao.active);
    const itens = opcoes.length
      ? opcoes.map((opcao) => ({ chave: `${produto.id}::${opcao.id}`, opcao: opcao.label, sku: opcao.sku, estoque: opcao.stock, varejo: opcao.price_cents }))
      : [{ chave: produto.id, opcao: null, sku: produto.sku, estoque: produto.stock, varejo: produto.price_cents }];
    for (const item of itens) {
      if (item.estoque <= 0 || item.varejo <= 0) continue;
      const comDesconto = precoComDesconto(item.varejo, venda.descontoPercent);
      const especial = venda.precos[item.chave] ?? null;
      const especialSemEfeito = especial !== null && especial >= comDesconto;
      linhas.push({
        chave: item.chave,
        produtoId: produto.id,
        nome: produto.name,
        opcao: item.opcao,
        sku: item.sku,
        categoria,
        estoque: item.estoque,
        varejoCents: item.varejo,
        comDescontoCents: comDesconto,
        especialCents: especial,
        especialSemEfeito,
        finalCents: especial !== null && !especialSemEfeito ? especial : comDesconto,
      });
    }
  }
  return linhas.sort((a, b) =>
    a.categoria.localeCompare(b.categoria, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR") || (a.opcao ?? "").localeCompare(b.opcao ?? "", "pt-BR"));
}

/** "10%" / "7,5%" */
export function formatarDesconto(percent: number): string {
  return `${percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
