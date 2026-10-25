export interface ProductResearchSource {
  title: string;
  url: string;
  domain: string;
}

export interface ProductResearchResult {
  name: string;
  brand: string;
  /** Modelo exato confirmado (vazio quando nao identificado). */
  model: string;
  /** GTIN em digitos: o informado ou o encontrado na pesquisa. */
  gtin: string;
  description: string;
  ncm: string;
  ncmConfidence: "high" | "medium" | "low";
  ncmNote: string;
  specifications: Array<{ label: string; value: string }>;
  /** Peso COM embalagem em gramas (vai para o envio). */
  weightGrams: number | null;
  /** Peso do produto sem embalagem, em gramas. */
  productWeightGrams: number | null;
  /** Medidas da EMBALAGEM em cm (vao para o envio); null quando nao confirmadas. */
  packageDimensions: { length: number; width: number; height: number } | null;
  /** Nome de categoria sugerido; o formulario casa com as categorias da loja. */
  category: string;
  /** Vazios quando nao confirmados para a variante exata. */
  color: string;
  voltage: string;
  warranty: string;
  packageContents: string;
  /** Ate cinco vantagens curtas, so com fatos confirmados. */
  advantages: string[];
  primarySourceUrl: string;
  sources: ProductResearchSource[];
  confidence: "high" | "medium" | "low";
  notes: string;
  /** De onde vieram os dados, para o lojista saber o que conferir. */
  providers: string[];
}
