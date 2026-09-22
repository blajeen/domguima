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
  /** Peso bruto em gramas, quando o cadastro do codigo de barras informa. */
  weightGrams: number | null;
  primarySourceUrl: string;
  sources: ProductResearchSource[];
  confidence: "high" | "medium" | "low";
  notes: string;
  /** De onde vieram os dados, para o lojista saber o que conferir. */
  providers: string[];
}
