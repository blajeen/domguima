/**
 * Leitura das mensagens de venda do WhatsApp.
 *
 * O controle diario da loja e feito num grupo, em mensagens como:
 *
 *     RETIRADA                     ENTREGA R$80 DUDU
 *     FLAVIN                       LUCAS
 *     01 SMART TV SAMSUNG 75U8600F Rua Marco Aurelio 330, Apto 704
 *     PAGO                         01 SMART TV LG 50" 50UA8550PSA
 *                                  R$2099,90 + R$80 ENTREGA
 *
 * REGRA CENTRAL: so e produto a linha que COMECA COM QUANTIDADE ("01 ...",
 * "03 ..."). Todo o resto — nome, endereco, valor, forma de pagamento — e
 * anotacao. Ja tentei aceitar "um produto por linha" sem o numero na frente, e
 * com as mensagens reais isso transformava "Rua do carteiro 25" em produto.
 * O numero na frente e o unico sinal confiavel que separa item de recado.
 *
 * Este modulo so LE o texto e propoe correspondencias com o catalogo. Ele
 * nunca decide sozinho: toda linha sai com um grau de certeza, e cabe a tela
 * de conferencia confirmar antes de qualquer pedido ser criado. Inventar o
 * produto errado aqui significaria baixar o estoque errado.
 *
 * Puro de proposito (sem I/O, sem "server-only"): a mesma funcao roda no
 * navegador para o operador ver o resultado enquanto digita, e no servidor
 * para revalidar antes de gravar.
 */

import type { OrderPaymentMethod } from "./types";

export type BulkChannel = "retirada" | "entrega" | "shopee" | "mercado_livre" | "magalu" | "outro";

export interface BulkParsedItem {
  /** Linha original, para o operador reconhecer o que veio da mensagem. */
  raw: string;
  quantity: number;
  name: string;
}

export interface BulkParsedBlock {
  channel: BulkChannel;
  /** Cabecalho como veio ("SHOPEE 04-09", "ENTREGA R$80 DUDU"). */
  header: string;
  /** Nome logo abaixo de RETIRADA/ENTREGA. Vazio quando a mensagem nao traz. */
  customerName: string;
  /** dd-mm lido do cabecalho, resolvido para ISO. Nulo quando nao ha data. */
  date: string | null;
  paid: boolean;
  paymentMethod: OrderPaymentMethod;
  items: BulkParsedItem[];
  /**
   * Tudo que nao era produto: endereco, recado, observacao. Vai junto para as
   * notas do pedido em vez de ser descartado — o endereco de entrega costuma
   * estar aqui e nao pode se perder.
   */
  notes: string[];
  /** Valores em centavos achados na mensagem, na ordem em que aparecem. */
  priceHints: number[];
}

const CANAIS: Array<{ padrao: RegExp; canal: BulkChannel; temCliente: boolean }> = [
  { padrao: /^retirada\b/, canal: "retirada", temCliente: true },
  { padrao: /^entrega\b/, canal: "entrega", temCliente: true },
  // "shopee?" pega tambem o "SHOPE 28-08" que aparece digitado sem o E.
  { padrao: /^shopee?\b/, canal: "shopee", temCliente: false },
  { padrao: /^(mercado ?livre|ml)\b/, canal: "mercado_livre", temCliente: false },
  { padrao: /^(magalu|magazine ?luiza)\b/, canal: "magalu", temCliente: false },
];

const MARCADORES_PAGO = /^(pago|paga|pg|pagos)$/;

const FORMAS_DE_PAGAMENTO: Array<{ padrao: RegExp; metodo: OrderPaymentMethod }> = [
  { padrao: /\bpix\b/, metodo: "pix" },
  { padrao: /\bcr[eé]dito\b|\bcart[aã]o de cr[eé]dito\b/, metodo: "credit_card" },
  { padrao: /\bd[eé]bito\b/, metodo: "debit_card" },
  { padrao: /\bboleto\b/, metodo: "boleto" },
];

/** Prefixo de exportacao do WhatsApp: "[12:42, 9/5/2026] Fulano: texto". */
const PREFIXO_WHATSAPP = /^\[[^\]]{3,40}\]\s*[^:]{1,60}:\s*/;

/**
 * "01 PRODUTO", "1x PRODUTO", "02 - PRODUTO".
 * O numero na frente e obrigatorio: e ele que distingue item de anotacao.
 */
const LINHA_ITEM = /^(\d{1,3})\s*(?:x|un|und|unid)?\s*[-–.)]?\s+(.{3,})$/i;

/**
 * R$2.099,90 · R$2100 · R$ 240,00 · R$4800,00
 *
 * A forma com ponto de milhar vem primeiro e EXIGE o ponto; sem isso a
 * alternativa de 1-3 digitos casava so o "209" de "2099,90" e o valor virava
 * R$209,00.
 */
const VALOR = /r\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/gi;

function limpar(linha: string): string {
  return linha.replace(PREFIXO_WHATSAPP, "").replace(/‎|‏/g, "").trim();
}

function chave(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Tira o negrito/italico do WhatsApp: _PRODUTO_, *PRODUTO*, ~PRODUTO~. */
function semFormatacao(texto: string): string {
  return texto.replace(/[_*~]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function valoresEmCentavos(linha: string): number[] {
  const achados: number[] = [];
  for (const encontro of linha.matchAll(VALOR)) {
    const bruto = encontro[1].replace(/\./g, "").replace(",", ".");
    const numero = Number(bruto);
    if (Number.isFinite(numero) && numero > 0) achados.push(Math.round(numero * 100));
  }
  return achados;
}

/**
 * Converte "04-09" para uma data ISO. Sem ano na mensagem, assume o ano
 * corrente; se isso jogar a data para o futuro (mensagem de dezembro lida em
 * janeiro), volta um ano.
 */
function resolverData(dia: number, mes: number, hoje: Date): string | null {
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  const ano = hoje.getFullYear();
  const candidata = new Date(Date.UTC(ano, mes - 1, dia, 12));
  if (candidata.getUTCMonth() !== mes - 1) return null;
  const limite = new Date(hoje.getTime() + 24 * 60 * 60 * 1000);
  const final = candidata > limite ? new Date(Date.UTC(ano - 1, mes - 1, dia, 12)) : candidata;
  return final.toISOString().slice(0, 10);
}

function lerCabecalho(linha: string, hoje: Date) {
  const texto = chave(linha);
  const encontrado = CANAIS.find((item) => item.padrao.test(texto));
  if (!encontrado) return null;
  // A data e procurada fora dos trechos de dinheiro: "ENTREGA R$40,00" nao
  // pode virar 40 de dezembro.
  const semDinheiro = linha.replace(VALOR, " ");
  const data = /(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?/.exec(semDinheiro);
  return {
    canal: encontrado.canal,
    temCliente: encontrado.temCliente,
    data: data ? resolverData(Number(data[1]), Number(data[2]), hoje) : null,
  };
}

/**
 * Quebra o texto colado em blocos, um por mensagem do grupo.
 *
 * @param hoje injetavel para o teste nao depender do relogio.
 */
export function parseBulkSalesText(text: string, hoje: Date = new Date()): BulkParsedBlock[] {
  const linhas = text.split(/\r?\n/).map(limpar);
  const blocos: BulkParsedBlock[] = [];
  let atual: (BulkParsedBlock & { temCliente: boolean }) | null = null;

  const fechar = () => {
    if (atual && (atual.items.length || atual.notes.length || atual.customerName)) {
      blocos.push({
        channel: atual.channel, header: atual.header, customerName: atual.customerName,
        date: atual.date, paid: atual.paid, paymentMethod: atual.paymentMethod,
        items: atual.items, notes: atual.notes, priceHints: atual.priceHints,
      });
    }
    atual = null;
  };

  for (const linha of linhas) {
    if (!linha) continue;

    const cabecalho = lerCabecalho(linha, hoje);
    if (cabecalho) {
      fechar();
      atual = {
        channel: cabecalho.canal, header: linha, customerName: "", date: cabecalho.data,
        paid: false, paymentMethod: "to_confirm", items: [], notes: [], priceHints: [],
        temCliente: cabecalho.temCliente,
      };
      continue;
    }

    // Linha solta antes de qualquer cabecalho: agrupa num bloco sem canal em
    // vez de descartar, para o operador ver que ela existe.
    if (!atual) {
      atual = {
        channel: "outro", header: "", customerName: "", date: null, paid: false,
        paymentMethod: "to_confirm", items: [], notes: [], priceHints: [], temCliente: true,
      };
    }

    const item = LINHA_ITEM.exec(linha);
    if (item) {
      atual.items.push({ raw: linha, quantity: Number(item[1]), name: semFormatacao(item[2]) });
      continue;
    }

    // Daqui para baixo nada vira produto — e anotacao.
    const marca = chave(semFormatacao(linha));
    if (MARCADORES_PAGO.test(marca)) { atual.paid = true; continue; }

    const forma = FORMAS_DE_PAGAMENTO.find((item) => item.padrao.test(marca));
    if (forma && atual.paymentMethod === "to_confirm") atual.paymentMethod = forma.metodo;

    atual.priceHints.push(...valoresEmCentavos(linha));

    // Nome do cliente: primeira linha nao-item logo apos RETIRADA/ENTREGA,
    // antes de qualquer produto. Nas mensagens em que o nome vem depois dos
    // itens, ele fica nas notas e o operador ajusta o campo na tela.
    if (atual.temCliente && !atual.customerName && !atual.items.length && !forma && !/r\$|\d{3}/.test(marca)) {
      atual.customerName = semFormatacao(linha);
      continue;
    }

    atual.notes.push(semFormatacao(linha));
  }

  fechar();
  return blocos;
}

// ---------------------------------------------------------------------------
// Correspondencia com o catalogo
// ---------------------------------------------------------------------------

export interface BulkMatchCandidate {
  productId: string;
  name: string;
  sku: string;
  stock: number;
  priceCents: number;
  score: number;
}

export type BulkMatchConfidence = "alta" | "duvidosa" | "nenhuma";

export interface BulkMatchResult {
  confidence: BulkMatchConfidence;
  best: BulkMatchCandidate | null;
  /** Sempre preenchido: alimenta o seletor manual da tela de conferencia. */
  alternatives: BulkMatchCandidate[];
}

export interface BulkMatchProduct {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price_cents: number;
}

function tokens(texto: string): string[] {
  return chave(texto).replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
}

/**
 * Codigo de modelo: token que mistura letra e numero (75u8600f, cbk09db,
 * me36b) ou numero longo.
 *
 * Ser codigo NAO basta para valer muito: "220v" e "110v" tambem passam nesta
 * forma. Quem decide o peso e a raridade (idf) e a lista de unidades abaixo.
 */
function ehCodigo(token: string): boolean {
  if (token.length < 3) return false;
  const temLetra = /[a-z]/.test(token);
  const temNumero = /[0-9]/.test(token);
  return (temLetra && temNumero) || (temNumero && token.length >= 4);
}

interface IndiceCatalogo {
  total: number;
  /** Em quantos produtos cada token aparece. */
  frequencia: Map<string, number>;
  documentos: Map<string, { tokens: Set<string>; codigos: string[] }>;
}

// Indexar 95 produtos a cada linha da mensagem seria desperdicio: o operador
// cola dezenas de linhas de uma vez. A chave e o proprio array recebido.
const indices = new WeakMap<object, IndiceCatalogo>();

function indexar(products: BulkMatchProduct[]): IndiceCatalogo {
  const guardado = indices.get(products);
  if (guardado) return guardado;

  const frequencia = new Map<string, number>();
  const documentos = new Map<string, { tokens: Set<string>; codigos: string[] }>();

  for (const product of products) {
    const conjunto = new Set(tokens(`${product.name} ${product.sku}`));
    documentos.set(product.id, {
      tokens: conjunto,
      codigos: [...conjunto].filter((token) => ehCodigo(token) && token.length >= 4),
    });
    for (const token of conjunto) frequencia.set(token, (frequencia.get(token) ?? 0) + 1);
  }

  const indice = { total: products.length, frequencia, documentos };
  indices.set(products, indice);
  return indice;
}

/**
 * Unidade de medida: 220v, 110v, 350w, 9000btus, 40cm, 10p, 4k.
 *
 * Sao atributo do produto, nunca a identidade dele — e a raridade nao ajuda a
 * perceber isso, porque o catalogo quase nao repete voltagem no nome. Sem esta
 * lista, "220v" passava por codigo raro e valia o triplo: era o que fazia
 * "BATED PLANETARIA MONDIAL 220V" casar com um liquidificador 220V.
 *
 * Numero puro ("32", "75") fica de fora de proposito: e polegada, e distingue
 * de verdade um modelo do outro.
 */
const UNIDADE_DE_MEDIDA = /^\d+(?:[.,]\d+)?(?:v|w|kw|kg|g|mg|ml|lt|l|cm|mm|pol|p|btus?|hz|ah|k)$/;

/** Raridade do token. Presente em quase todo produto → perto de zero. */
function peso(token: string, indice: IndiceCatalogo): number {
  if (UNIDADE_DE_MEDIDA.test(token)) return 0.35;
  const df = indice.frequencia.get(token) ?? 0;
  return Math.log((indice.total + 1) / (df + 1));
}

/**
 * Nota de 0 a 1: quanto da informacao util da linha o produto explica.
 * Normalizar pelo maximo possivel deixa a nota comparavel entre linhas curtas
 * ("FONE OEX PRETO HS409") e longas ("AR CONDICIONADO CONSUL TRIPLE INV...").
 */
function pontuar(busca: string[], produto: BulkMatchProduct, indice: IndiceCatalogo): number {
  const doc = indice.documentos.get(produto.id);
  if (!doc || !busca.length) return 0;

  let obtido = 0;
  let maximo = 0;

  for (const token of busca) {
    // Codigo raro vale o triplo; codigo comum, nao. "220v" e "110v" tem a
    // forma de codigo mas sao atributo — dar peso a eles fazia uma batedeira
    // casar com um liquidificador so pela voltagem.
    const raro = (indice.frequencia.get(token) ?? 0) <= 2 && !UNIDADE_DE_MEDIDA.test(token);
    const codigo = ehCodigo(token);
    const valor = peso(token, indice) * (codigo && raro ? 3 : 1);
    maximo += valor;

    if (doc.tokens.has(token)) {
      obtido += valor;
      continue;
    }

    // Abreviacao: as mensagens cortam palavra o tempo todo ("VENT.WAP",
    // "SEC.BRITANIA", "INV. 9000BTUS", "BATED.PLANETARIA"). Se o token e
    // inicio de uma palavra do produto, conta quase inteiro.
    if (!codigo && token.length >= 3) {
      for (const alvo of doc.tokens) {
        if (alvo.length > token.length && alvo.startsWith(token)) { obtido += valor * 0.7; break; }
      }
      continue;
    }

    if (codigo && token.length >= 4) {
      const alvo = doc.codigos.find((item) => item.includes(token) || token.includes(item));
      if (alvo) {
        // "75U8600F" na mensagem vs "75\" ... U8600F" no catalogo: o que sobra
        // do codigo ("75") e justamente o que separa a TV de 75" da de 55".
        // Se essa sobra tambem esta no produto, o casamento e exato na pratica.
        const sobra = token.length > alvo.length ? token.replace(alvo, "") : alvo.replace(token, "");
        obtido += sobra && doc.tokens.has(sobra) ? valor : valor * 0.45;
      }
    }
  }

  return maximo > 0 ? obtido / maximo : 0;
}

/**
 * Procura o produto do catalogo correspondente a uma linha da mensagem.
 *
 * A folga entre o primeiro e o segundo colocado importa tanto quanto a nota:
 * dois produtos quase empatados significam duvida real (duas TVs da mesma
 * linha, por exemplo), e nesse caso quem decide e o operador.
 */
export function matchBulkProduct(rawName: string, products: BulkMatchProduct[]): BulkMatchResult {
  const indice = indexar(products);
  const busca = tokens(rawName);

  const notas = products
    .map((product) => ({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      priceCents: product.price_cents,
      score: Math.round(pontuar(busca, product, indice) * 1000) / 1000,
    }))
    .filter((item) => item.score > 0.05)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const best = notas[0] ?? null;
  const segundo = notas[1];
  const alternatives = notas.slice(0, 8);

  if (!best || best.score < 0.3) return { confidence: "nenhuma", best: null, alternatives };
  const folga = best.score - (segundo?.score ?? 0);
  if (best.score >= 0.62 && folga >= 0.12) return { confidence: "alta", best, alternatives };
  return { confidence: "duvidosa", best, alternatives };
}

/**
 * Identidade estavel do bloco, usada como request_id do pedido.
 *
 * Colar a mesma mensagem duas vezes (o lancamento de sabado repetido, a rolagem
 * que pegou a semana inteira de novo) precisa dar no mesmo pedido, e nao em
 * dois. O indice unico de request_id no banco cuida do resto.
 */
export function bulkRequestId(block: { channel: string; date: string | null; customerName: string; items: Array<{ quantity: number; name: string }> }): string {
  const assinatura = [
    chave(block.channel),
    block.date ?? "sem-data",
    chave(block.customerName),
    ...block.items.map((item) => `${item.quantity}x${chave(item.name)}`).sort(),
  ].join("|");

  // Dois FNV-1a em sentidos opostos: curto, estavel entre navegador e
  // servidor, sem dependencia. O segundo passe reduz colisao sem custo real.
  let ida = 0x811c9dc5;
  for (let i = 0; i < assinatura.length; i += 1) {
    ida ^= assinatura.charCodeAt(i);
    ida = Math.imul(ida, 0x01000193) >>> 0;
  }
  let volta = 0x9e3779b1;
  for (let i = assinatura.length - 1; i >= 0; i -= 1) {
    volta ^= assinatura.charCodeAt(i);
    volta = Math.imul(volta, 0x85ebca6b) >>> 0;
  }
  return `lote-${ida.toString(36)}${volta.toString(36)}`;
}
