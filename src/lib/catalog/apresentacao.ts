import { normalize, paymentLines, type PaymentLines } from "@/lib/utils/format";
import type { Product, ProductImage, ProductVariantOption, Specification } from "./types";

/*
 * Como o catálogo aparece na loja. Nada aqui muda o dado: são leituras do que
 * o cadastro já tem (fotos, ficha técnica, preço), feitas num lugar só para a
 * página de produto, o card e a galeria mostrarem a mesma coisa. Sem imports
 * de servidor: serve em server e client components.
 */

/**
 * Nome da transição de foto (View Transition) de um produto: é o que liga a
 * foto do card à foto principal da galeria. Precisa ser um identificador CSS
 * válido e único na tela.
 */
export function nomeFotoProduto(id: string): string {
  return `foto-produto-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

/**
 * Fotos que a galeria pode mostrar, na ordem do cadastro. Tira só o que não
 * tem como virar imagem (caminho vazio ou que não é "/..." nem "http...") e a
 * mesma foto cadastrada duas vezes: a repetida dividia a chave com a outra e
 * virava um quadro em branco. A ordem e a capa não mudam.
 */
export function fotosDaGaleria(images: ProductImage[]): ProductImage[] {
  const vistas = new Set<string>();
  return images.filter((image) => {
    const src = image.src.trim();
    if (!src || !(src.startsWith("/") || /^https?:\/\//.test(src)) || vistas.has(src)) return false;
    vistas.add(src);
    return true;
  });
}

const DESTAQUE = /^destaque\s*\d*$/i;

/**
 * Separa a ficha do cadastro em duas leituras: os "Destaque 1..N" (frases da
 * lista de vendas, que viram uma lista) e os pares de verdade (Cor, Voltagem,
 * Capacidade...), que continuam na tabela. Antes os destaques entravam na
 * tabela com o rótulo "Destaque 1", que não diz nada ao cliente.
 */
export function dividirFicha(specs: Specification[]): {
  destaques: string[];
  ficha: Specification[];
} {
  const destaques: string[] = [];
  const ficha: Specification[] = [];
  for (const spec of specs) {
    if (!spec.value.trim()) continue;
    if (DESTAQUE.test(spec.label.trim())) destaques.push(spec.value.trim());
    else ficha.push(spec);
  }
  return { destaques, ficha };
}

export interface NumeroDoProduto {
  /** O número com a unidade, como vai na tela ("1100 W", "23 L", "220V"). */
  valor: string;
  /** Rótulo curto em caixa baixa ("potência"). */
  rotulo: string;
}

/** Número com vírgula ou ponto de milhar, como o lojista escreve ("14,5", "1.500"). */
const N = String.raw`(\d+(?:[.,]\d+)*)`;

interface Leitor {
  rotulo: string;
  /** Rótulos da ficha (sem acento, caixa baixa) que já dão o valor pronto. */
  rotulos?: string[];
  /** Padrões nas frases de destaque. O 1º grupo é o número; o 2º, a unidade. */
  padroes?: RegExp[];
  /** Monta o valor a partir do número e da unidade encontrados. */
  valor?: (numero: string, unidade: string) => string;
}

const litros = (unidade: string) => (/^l/i.test(unidade) ? "L" : unidade.toLowerCase());

/*
 * Ordem de prioridade dos números. Os padrões só pegam frases em que o número
 * é afirmado sem ressalva: "Potência de até 200W" e "Potência de 12V" (que é
 * tensão, não potência) ficam de fora de propósito, para a faixa nunca dizer
 * mais do que a ficha diz.
 */
const LEITORES: Leitor[] = [
  {
    rotulo: "potência",
    rotulos: ["potencia"],
    padroes: [
      new RegExp(String.raw`^potência de ${N}\s?W\b`, "i"),
      new RegExp(String.raw`\b${N}\s?W de potência\b`, "i"),
    ],
    valor: (n) => `${n} W`,
  },
  {
    rotulo: "capacidade",
    rotulos: ["capacidade"],
    padroes: [
      new RegExp(String.raw`^capacidade (?:total )?de ${N}\s?(kg|l|litros|ml)\b`, "i"),
      new RegExp(String.raw`\b${N}\s?(l|kg|ml) de capacidade\b`, "i"),
    ],
    valor: (n, unidade) => `${n} ${litros(unidade)}`,
  },
  {
    rotulo: "serviços",
    padroes: [new RegExp(String.raw`^capacidade de ${N} serviços\b`, "i")],
    valor: (n) => n,
  },
  {
    rotulo: "reservatório",
    padroes: [new RegExp(String.raw`^reservatório de ${N}\s?(l|litros)\b`, "i")],
    valor: (n, unidade) => `${n} ${litros(unidade)}`,
  },
  { rotulo: "voltagem", rotulos: ["voltagem", "tensao"] },
  { rotulo: "tela", rotulos: ["tela", "tamanho da tela"] },
  {
    rotulo: "atualização",
    padroes: [new RegExp(String.raw`^taxa de atualização de ${N}\s?Hz\b`, "i")],
    valor: (n) => `${n} Hz`,
  },
  {
    rotulo: "tempo de resposta",
    padroes: [new RegExp(String.raw`^tempo de resposta de (?:apenas )?${N}\s?ms\b`, "i")],
    valor: (n) => `${n} ms`,
  },
  {
    rotulo: "armazenamento",
    padroes: [new RegExp(String.raw`^${N}\s?(GB|TB) de armazenamento\b`, "i")],
    valor: (n, unidade) => `${n} ${unidade.toUpperCase()}`,
  },
  {
    rotulo: "grade",
    padroes: [new RegExp(String.raw`\bgrade de ${N}\s?cm\b`, "i")],
    valor: (n) => `${n} cm`,
  },
  {
    rotulo: "torque",
    padroes: [new RegExp(String.raw`^torque de ${N}\s?N\.?m\b`, "i")],
    valor: (n) => `${n} N·m`,
  },
  {
    rotulo: "hélice",
    padroes: [new RegExp(String.raw`\bhélice de ${N} pás\b`, "i")],
    valor: (n) => `${n} pás`,
  },
];

/** Valor da ficha que cabe na faixa: curto e sem ressalva entre parênteses. */
function valorCurto(value: string): string | null {
  const texto = value.trim();
  return texto.length > 0 && texto.length <= 16 && !/[(),;]/.test(texto) ? texto : null;
}

/**
 * "Números do produto": até três pares tirados da ficha que já existe (os
 * rótulos da tabela e as frases de destaque). Sem dado, a lista sai vazia e a
 * página não mostra a faixa. Voltagem que o cliente escolhe no seletor não
 * entra: ali ela é opção, não característica fixa.
 */
export function numerosDoProduto(product: Product): NumeroDoProduto[] {
  const { destaques, ficha } = dividirFicha(product.specifications);
  const escolheVoltagem =
    /volt|tens/i.test(product.variantAxis ?? "") ||
    Boolean(product.variants?.some((variant) => /volt|tens/i.test(variant.name)));

  const numeros: NumeroDoProduto[] = [];
  for (const leitor of LEITORES) {
    if (numeros.length === 3) break;
    if (leitor.rotulo === "voltagem" && escolheVoltagem) continue;

    const daFicha = leitor.rotulos
      ? ficha.find((spec) => leitor.rotulos?.includes(normalize(spec.label)))
      : undefined;
    const valorFicha = daFicha ? valorCurto(daFicha.value) : null;
    if (valorFicha) {
      numeros.push({ valor: valorFicha, rotulo: leitor.rotulo });
      continue;
    }

    for (const frase of destaques) {
      const achado = leitor.padroes?.map((padrao) => frase.match(padrao)).find(Boolean);
      if (achado && leitor.valor) {
        numeros.push({ valor: leitor.valor(achado[1], achado[2] ?? ""), rotulo: leitor.rotulo });
        break;
      }
    }
  }
  return numeros;
}

/**
 * Linhas de Pix e cartão do preço mostrado na página de produto, com a mesma
 * frase do card (`paymentLines`). Cada opção tem o parcelado calculado sobre o
 * preço dela (no servidor, em `comParcelamento`, lib/catalog/database.ts),
 * então a opção mais cara mostra a parcela certa em vez de perder a linha do
 * cartão.
 */
export function linhasDoPreco(product: Product, opcao?: ProductVariantOption): PaymentLines {
  return paymentLines(opcao ? opcao.cardInstallment : product.cardInstallment);
}
