export interface ProductResearchSource {
  title: string;
  url: string;
  domain: string;
}

export interface ProductResearchResult {
  name: string;
  brand: string;
  description: string;
  ncm: string;
  ncmConfidence: "high" | "medium" | "low";
  ncmNote: string;
  specifications: Array<{ label: string; value: string }>;
  primarySourceUrl: string;
  sources: ProductResearchSource[];
  confidence: "high" | "medium" | "low";
  notes: string;
}
