"use client";

import { useActionState, useMemo, useState } from "react";
import { saveProductAction } from "@/app/painel/actions";
import type { CategorySkuChoice } from "@/lib/admin/sku";
import type { AdminCategoryRow, AdminProductRow, ProductAssistTemplate, ProductOperationalMeta } from "@/lib/admin/types";
import type { ProductResearchResult } from "@/lib/admin/product-research-types";
import { formatPrice, normalize, paymentLines } from "@/lib/utils/format";
import { onlyDigits } from "@/lib/utils/validators";
import { FormMessage, SubmitButton, fieldClass, labelClass } from "./FormControls";
import { parcelamentoMaximo, type ParcelamentoDaLoja } from "@/lib/catalog/parcelamento";
import { InstallmentSimulator } from "./InstallmentSimulator";
import { ProductResearchAssistant, type ResearchFillReport, type ResearchLookup } from "./ProductResearchAssistant";
import { VariantEditor } from "./VariantEditor";

interface ProductFormProps {
  product?: AdminProductRow | null;
  categories: AdminCategoryRow[];
  operationalMeta?: ProductOperationalMeta;
  initialCategoryId?: string;
  skuChoices?: CategorySkuChoice[];
  templates?: ProductAssistTemplate[];
  /** Falso enquanto a migracao de variacoes nao foi aplicada ao banco. */
  variantsSupported?: boolean;
  /** Tabela da maquininha e chamada de Configuracoes, para mostrar o parcelado que o site vai calcular. */
  parcelamento: ParcelamentoDaLoja;
}

export function ProductForm({ product, categories, operationalMeta, initialCategoryId = "", skuChoices = [], templates = [], variantsSupported = true, parcelamento }: ProductFormProps) {
  const [state, action] = useActionState(saveProductAction, {});
  const choicesByCategory = useMemo(() => new Map(skuChoices.map((choice) => [choice.categoryId, choice])), [skuChoices]);
  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const knownBrands = useMemo(() => [...new Set(templates.map((template) => template.brand.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [templates]);
  const startingCategory = product?.category_id ?? initialCategoryId;
  const startingChoice = choicesByCategory.get(startingCategory);
  const [categoryId, setCategoryId] = useState(startingCategory);
  const [sku, setSku] = useState(product?.sku ?? startingChoice?.nextSku ?? "");
  const [automaticSku, setAutomaticSku] = useState(!product && Boolean(startingChoice));
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [automaticSlug, setAutomaticSlug] = useState(!product);
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [model, setModel] = useState(operationalMeta?.model ?? "");
  const [gtin, setGtin] = useState(operationalMeta?.gtin ?? "");
  const [ncm, setNcm] = useState(operationalMeta?.ncm ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [tags, setTags] = useState(product?.tags.join(", ") ?? "");
  const [specs, setSpecs] = useState(product?.specifications.map((item) => `${item.label}: ${item.value}`).join("\n") ?? "");
  const [variants, setVariants] = useState(product?.variants.map((item) => `${item.name}: ${item.options.join(", ")}`).join("\n") ?? "");
  const [sellerNote, setSellerNote] = useState(product?.seller_note ?? "");
  const [sourceUrl, setSourceUrl] = useState(product?.source_url ?? "");
  const [cost, setCost] = useState(cents(operationalMeta?.cost_cents));
  const [price, setPrice] = useState(cents(product?.price_cents));
  const [shipping, setShipping] = useState({ weight: String(product?.shipping.weight ?? 0), length: String(product?.shipping.dimensions.length ?? 0), width: String(product?.shipping.dimensions.width ?? 0), height: String(product?.shipping.dimensions.height ?? 0), origin: product?.shipping.origin ?? "Minas Gerais" });
  const [templateQuery, setTemplateQuery] = useState("");
  const [assistMessage, setAssistMessage] = useState("");
  const [fillSnapshot, setFillSnapshot] = useState<FillSnapshot | null>(null);
  // Valor que a ultima busca gravou em cada campo. Enquanto o campo continua
  // com esse valor, ele e "da busca" e nao do lojista: escanear outro codigo
  // pode troca-lo sem perguntar.
  const [autoFilled, setAutoFilled] = useState<Record<string, string>>({});
  // Trocar a chave recria a caixa de busca e some com o cartao do resultado:
  // depois de copiar estrutura, o "Desfazer" ja nao descreveria o formulario.
  const [assistKey, setAssistKey] = useState(0);

  const templateMatches = useMemo(() => {
    const term = normalize(templateQuery);
    if (!term) return [];
    return templates.filter((template) => normalize(`${template.name} ${template.sku} ${template.brand} ${template.category_name}`).includes(term)).slice(0, 6);
  }, [templateQuery, templates]);
  const suggestedBrand = useMemo(() => knownBrands.filter((item) => normalize(name).includes(normalize(item))).sort((a, b) => b.length - a.length)[0] ?? "", [knownBrands, name]);
  const comparisonTerm = gtin || [brand, model].filter(Boolean).join(" ").trim() || name.trim();
  const costCents = moneyInputToCents(cost);
  const priceCents = moneyInputToCents(price);
  const grossProfit = priceCents - costCents;
  const marginPercent = priceCents > 0 ? (grossProfit / priceCents) * 100 : 0;

  function changeName(value: string) { setName(value); if (automaticSlug) setSlug(slugify(value)); }
  function changeCategory(nextCategory: string) {
    setCategoryId(nextCategory);
    if (!product) { const choice = choicesByCategory.get(nextCategory); setSku(choice?.nextSku ?? ""); setAutomaticSku(Boolean(choice)); }
  }
  function applySuggestions() {
    const nextBrand = brand || suggestedBrand;
    if (!brand && suggestedBrand) setBrand(suggestedBrand);
    setSlug(slugify(name)); setAutomaticSlug(true);
    setTags(buildTags(name, nextBrand, model, categoryNames.get(categoryId) ?? ""));
    if (!description.trim()) setDescription(buildDescription(name, nextBrand, model, categoryNames.get(categoryId) ?? ""));
    forgetResearch();
    setAssistMessage("Sugestões aplicadas. Revise os textos antes de salvar.");
  }
  function copyTemplate(template: ProductAssistTemplate) {
    changeCategory(template.category_id); setBrand(template.brand); setDescription(template.description); setTags(template.tags.join(", "));
    setSpecs(template.specifications.map((item) => `${item.label}: ${item.value}`).join("\n"));
    setVariants(template.variants.map((item) => `${item.name}: ${item.options.join(", ")}`).join("\n")); setSellerNote(template.seller_note);
    setShipping({ weight: String(template.shipping.weight), length: String(template.shipping.dimensions.length), width: String(template.shipping.dimensions.width), height: String(template.shipping.dimensions.height), origin: template.shipping.origin });
    setTemplateQuery(""); forgetResearch(); setAssistMessage(`Estrutura copiada de “${template.name}”. Nome, modelo, EAN, preço, custo e estoque não foram copiados.`);
  }

  /**
   * Preenche so o que esta vazio (ou o que a busca anterior preencheu e
   * ninguem mexeu); o que o lojista digitou fica, e volta como "mantido" para
   * ele decidir. `replace` e o botao "Substituir pelos encontrados": troca
   * exatamente os campos listados, nada alem. O GTIN/modelo pesquisado entra
   * sempre, porque foi o lojista que digitou.
   */
  function applyResearch(result: ProductResearchResult, lookup: ResearchLookup, replace: string[] | null): ResearchFillReport {
    const replacing = replace ? new Set(replace) : null;
    if (!replacing) setFillSnapshot({ name, slug, automaticSlug, brand, model, gtin, ncm, description, specs, tags, sourceUrl, weight: shipping.weight, autoFilled });
    const filled: string[] = [];
    const kept: string[] = [];
    const written: Record<string, string> = {};
    function decide(label: string, current: string, next: string, set: (value: string) => void, force = false): string {
      const atual = current.trim();
      const novo = next.trim();
      if (!novo || atual === novo) return atual;
      const livre = !atual || autoFilled[label] === atual;
      if (replacing ? replacing.has(label) : force || livre) { set(novo); filled.push(label); written[label] = novo; return novo; }
      if (!replacing) kept.push(label);
      return atual;
    }
    const knownBrand = knownBrands.find((item) => normalize(item) === normalize(result.brand)) ?? result.brand;
    const finalName = decide("Nome", name, result.name, changeName);
    const finalBrand = decide("Marca", brand, knownBrand, setBrand);
    const finalModel = decide("Modelo", model, lookup.kind === "model" ? lookup.value : result.model, setModel, lookup.kind === "model");
    decide("EAN/GTIN", gtin, lookup.kind === "gtin" ? lookup.value : result.gtin, setGtin, lookup.kind === "gtin");
    decide("NCM", ncm, result.ncm, setNcm);
    decide("Descrição", description, result.description, setDescription);
    decide("Especificações", specs, result.specifications.map((item) => `${item.label}: ${item.value}`).join("\n"), setSpecs);
    decide("Link da fonte", sourceUrl, result.primarySourceUrl, setSourceUrl);
    decide("Peso", Number(shipping.weight) > 0 ? shipping.weight : "", result.weightGrams ? String(result.weightGrams) : "", (value) => setShipping((current) => ({ ...current, weight: value })));
    if (finalName) decide("Palavras-chave", tags, buildTags(finalName, finalBrand, finalModel, categoryNames.get(categoryId) ?? ""), setTags);
    setAutoFilled((current) => ({ ...current, ...written }));
    setAssistMessage("");
    return { filled, kept };
  }

  function undoResearch() {
    if (!fillSnapshot) return;
    setName(fillSnapshot.name); setSlug(fillSnapshot.slug); setAutomaticSlug(fillSnapshot.automaticSlug);
    setBrand(fillSnapshot.brand); setModel(fillSnapshot.model); setGtin(fillSnapshot.gtin); setNcm(fillSnapshot.ncm);
    setDescription(fillSnapshot.description); setSpecs(fillSnapshot.specs); setTags(fillSnapshot.tags); setSourceUrl(fillSnapshot.sourceUrl);
    setShipping((current) => ({ ...current, weight: fillSnapshot.weight }));
    setAutoFilled(fillSnapshot.autoFilled);
    setFillSnapshot(null);
  }

  /** Outra ferramenta mexeu no formulario: o resultado da busca deixa de valer. */
  function forgetResearch() {
    setFillSnapshot(null);
    setAutoFilled({});
    setAssistKey((current) => current + 1);
  }

  return <form action={action} className="space-y-6">
    <input type="hidden" name="id" value={product?.id ?? ""} /><input type="hidden" name="skuMode" value={automaticSku ? "auto" : "manual"} />

    <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Assistente de cadastro</p><h2 className="mt-1 text-lg font-black text-ink-900">Preencher mais rápido</h2><p className="mt-1 text-xs text-ink-500">Escaneie o código de barras ou digite o modelo: o painel busca os dados e preenche o cadastro. Nada é publicado sem você salvar.</p></div><button type="button" onClick={applySuggestions} disabled={!name.trim()} title="Gera palavras-chave, marca e uma descrição-base a partir do nome" className="rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-xs font-black text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40">Sugestões pelo nome</button></div>
      <ProductResearchAssistant key={assistKey} name={name} brand={brand} model={model} gtin={gtin} category={categoryNames.get(categoryId) ?? ""} autoFocus={!product && assistKey === 0} onApply={applyResearch} onUndo={undoResearch} />
      {!product && <div className="relative mt-4 max-w-2xl"><label className={labelClass}>Copiar estrutura de um produto semelhante<input value={templateQuery} onChange={(event) => setTemplateQuery(event.target.value)} placeholder="Busque por nome, SKU, marca ou categoria" className={fieldClass} /></label>{templateQuery && <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl">{templateMatches.map((template) => <button key={template.id} type="button" onClick={() => copyTemplate(template)} className="flex w-full items-center justify-between gap-4 border-b border-ink-100 px-4 py-3 text-left last:border-0 hover:bg-blue-50"><span><strong className="block text-sm">{template.name}</strong><small className="text-ink-500">{template.category_name} · SKU {template.sku}</small></span><span className="shrink-0 text-[10px] font-black uppercase text-blue-700">Usar modelo</span></button>)}{!templateMatches.length && <p className="px-4 py-5 text-center text-sm text-ink-500">Nenhum produto semelhante encontrado.</p>}</div>}</div>}
      {suggestedBrand && !brand && <button type="button" onClick={() => setBrand(suggestedBrand)} className="mt-3 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-800">Usar marca sugerida: {suggestedBrand}</button>}
      {assistMessage && <p role="status" className="mt-3 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-xs leading-relaxed text-gold-900">{assistMessage}</p>}
    </section>

    <Section title="Informações principais" description="Comece pelos dados que identificam exatamente o produto."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field name="name" label="Nome do produto" value={name} onChange={(event) => changeName(event.target.value)} required className="sm:col-span-2 lg:col-span-3" error={state.errors?.name} />
      <label className={labelClass}>Marca<input name="brand" value={brand} onChange={(event) => setBrand(event.target.value)} list="product-brand-options" className={fieldClass} /><datalist id="product-brand-options">{knownBrands.map((item) => <option key={item} value={item} />)}</datalist></label>
      <Field name="model" label="Modelo" value={model} onChange={(event) => setModel(event.target.value)} maxLength={100} placeholder="Ex.: 50UA8550PSA" hint="Ajuda a encontrar o produto exato na internet." />
      <Field name="gtin" label="EAN / GTIN" value={gtin} onChange={(event) => setGtin(onlyDigits(event.target.value).slice(0, 14))} inputMode="numeric" maxLength={14} placeholder="Código de barras" hint="Para preencher o cadastro pelo código, use a busca no topo." />
      <label className={labelClass}>Categoria<select name="categoryId" value={categoryId} onChange={(event) => changeCategory(event.target.value)} required className={fieldClass}><option value="">Selecione</option>{categories.filter((item) => item.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className={labelClass}>SKU<div className="relative"><input name="sku" value={sku} onChange={(event) => { setSku(event.target.value.toUpperCase()); setAutomaticSku(false); }} required className={`${fieldClass} pr-24 font-mono font-bold`} /><span className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[9px] font-black uppercase ${automaticSku ? "bg-green-50 text-green-700" : "bg-ink-50 text-ink-500"}`}>{automaticSku ? "Automático" : "Manual"}</span></div>{!product && choicesByCategory.get(categoryId) && <button type="button" onClick={() => { setSku(choicesByCategory.get(categoryId)!.nextSku); setAutomaticSku(true); }} className="mt-1 text-left text-[11px] font-bold text-blue-700 hover:underline">Usar próximo código: {choicesByCategory.get(categoryId)!.nextSku}</button>}{state.errors?.sku && <ErrorText value={state.errors.sku} />}</label>
      <label className={labelClass}>Endereço (slug)<div className="relative"><input name="slug" value={slug} onChange={(event) => { setSlug(slugify(event.target.value)); setAutomaticSlug(false); }} required className={`${fieldClass} pr-24`} /><span className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[9px] font-black uppercase ${automaticSlug ? "bg-green-50 text-green-700" : "bg-ink-50 text-ink-500"}`}>{automaticSlug ? "Automático" : "Manual"}</span></div>{!product && <button type="button" onClick={() => { setSlug(slugify(name)); setAutomaticSlug(true); }} className="mt-1 text-[11px] font-bold text-blue-700 hover:underline">Gerar novamente pelo nome</button>}{state.errors?.slug && <ErrorText value={state.errors.slug} />}</label>
      <Field name="ncm" label="NCM" inputMode="numeric" maxLength={8} value={ncm} onChange={(event) => setNcm(onlyDigits(event.target.value).slice(0, 8))} hint="Sugestão assistida; confira com a contabilidade." />
      <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>Descrição<textarea name="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} required className={fieldClass} /><button type="button" onClick={() => { setDescription(buildDescription(name, brand, model, categoryNames.get(categoryId) ?? "")); setAssistMessage("Descrição-base criada. Revise antes de publicar."); }} disabled={!name.trim()} className="mt-1 text-[11px] font-bold text-blue-700 hover:underline disabled:opacity-40">Montar descrição-base</button>{state.errors?.description && <ErrorText value={state.errors.description} />}</label>
    </div></Section>

    <Section title="Preço, estoque e publicação" description="Novos produtos já ficam publicados por padrão. Você pode escolher rascunho quando quiser preparar o cadastro antes de mostrar na loja."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field name="cost" label="Custo (R$)" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} hint="Uso interno; não aparece na loja." /><Field name="price" label="Preço à vista (R$)" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required error={state.errors?.priceCents} hint="Pix ou dinheiro. O parcelado no cartão é calculado sozinho." /><Field name="oldPrice" label="Preço anterior (R$)" inputMode="decimal" defaultValue={cents(product?.old_price_cents)} hint="Opcional; deve ser maior." />
      {product ? <label className={labelClass}>Estoque atual<input value={product.stock} disabled className={`${fieldClass} bg-ink-50`} /><input type="hidden" name="stock" value={product.stock} /><span className="mt-1 block font-normal text-ink-400">Use a tela Estoque para alterar.</span></label> : <Field name="stock" label="Estoque inicial" type="number" min="0" defaultValue={0} required />}
      <Field name="lowStockThreshold" label="Avisar estoque baixo em" type="number" min="0" defaultValue={product?.low_stock_threshold ?? 3} required /><label className={labelClass}>Status<select name="status" defaultValue={product?.status ?? "active"} className={fieldClass}><option value="active">Publicado</option><option value="draft">Rascunho</option><option value="archived">Arquivado</option></select></label>
      <div className={`rounded-xl border p-4 sm:col-span-2 ${costCents > 0 && priceCents > 0 ? grossProfit >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50" : "border-ink-200 bg-ink-50"}`}><p className="text-[10px] font-black uppercase tracking-wide text-ink-500">Margem bruta estimada</p>{costCents > 0 && priceCents > 0 ? <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><strong className={`text-xl ${grossProfit >= 0 ? "text-green-800" : "text-red-700"}`}>{formatPrice(grossProfit)}</strong><span className="ml-2 text-sm font-bold text-ink-600">{marginPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span></div><small className="text-ink-500">Antes de impostos, frete e comissão</small></div> : <p className="mt-2 text-xs text-ink-500">Preencha custo e preço para calcular.</p>}</div><PrecoNoSite priceCents={priceCents} parcelamento={parcelamento} comVariacoes={variantsSupported && (product?.product_variants ?? []).some((opcao) => opcao.active)} />
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:col-span-2 lg:col-span-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black text-blue-950">Comparativo de preços</p><p className="mt-1 text-xs text-blue-700">Pesquisa atual: {comparisonTerm || "informe nome, modelo ou EAN"}</p></div><div className="flex flex-wrap gap-2"><SearchLink label="Google Shopping" href={comparisonTerm ? googleShoppingUrl(comparisonTerm) : ""} /><SearchLink label="Buscar preços no Google" href={comparisonTerm ? googlePriceUrl(comparisonTerm) : ""} /></div></div><p className="mt-2 text-[10px] leading-relaxed text-blue-600">Os resultados abrem no Google para conferência. O painel não copia preços nem altera sua oferta automaticamente.</p></div>
      <div className="flex flex-wrap gap-4 sm:col-span-2 lg:col-span-3 lg:pt-2"><Check name="isFeatured" label="Destaque na home" checked={product?.is_featured} /><Check name="isOffer" label="Oferta" checked={product?.is_offer} /><Check name="isBestSeller" label="Seleção mais vendidos" checked={product?.is_best_seller} /><Check name="isExclusive" label="Exclusivo Dom Guima" checked={product?.is_exclusive} /><Check name="heroEnabled" label="Pode aparecer no banner" checked={product?.hero_enabled ?? true} /></div><Field name="heroPriority" label="Prioridade no banner" type="number" min="-100" max="100" defaultValue={product?.hero_priority ?? 0} hint="0 = automático; use de -100 a 100 para ajustar." />
    </div></Section>

    <VariantEditor skuBase={sku} precoBase={priceCents} variantAxis={product?.variant_axis} variants={product?.product_variants} imagens={(product?.product_images ?? []).map((foto) => ({ src: foto.src, alt: foto.alt }))} disponivel={variantsSupported} />

      <Section title="Detalhes comerciais" description="Abra somente quando precisar revisar textos e especificações." collapsible><div className="grid gap-4 sm:grid-cols-2"><label className={`${labelClass} sm:col-span-2`}>Palavras-chave<textarea name="tags" value={tags} onChange={(event) => setTags(event.target.value)} rows={2} className={fieldClass} /><button type="button" onClick={() => setTags(buildTags(name, brand, model, categoryNames.get(categoryId) ?? ""))} className="mt-1 text-[11px] font-bold text-blue-700 hover:underline">Sugerir palavras-chave</button></label><Field name="sourceUrl" label="Link do anúncio original" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /><Field name="sellerNote" label="Observação do vendedor" value={sellerNote} onChange={(event) => setSellerNote(event.target.value)} /><label className={labelClass}>Especificações<textarea name="specifications" value={specs} onChange={(event) => setSpecs(event.target.value)} rows={7} className={fieldClass} placeholder={'Potência: 1500W\nCor: Preto'} /><span className="mt-1 block font-normal text-ink-400">Uma por linha, no formato Campo: Valor.</span></label><label className={labelClass}>Variações<textarea name="variants" value={variants} onChange={(event) => setVariants(event.target.value)} rows={7} className={fieldClass} placeholder="Voltagem: 110V, 220V" /><span className="mt-1 block font-normal text-ink-400">Apenas informativo, sem estoque nem preço próprios. Para cor ou voltagem com estoque separado, use o quadro <strong>“Este produto tem variações”</strong> acima.</span></label></div></Section>

    <Section title="Envio" description="Peso e dimensões podem ser copiados de um produto semelhante, mas devem ser conferidos." collapsible><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Field name="shippingWeight" label="Peso (gramas)" type="number" min="0" value={shipping.weight} onChange={(event) => setShipping((current) => ({ ...current, weight: event.target.value }))} /><Field name="shippingLength" label="Comprimento (cm)" type="number" min="0" step="0.1" value={shipping.length} onChange={(event) => setShipping((current) => ({ ...current, length: event.target.value }))} /><Field name="shippingWidth" label="Largura (cm)" type="number" min="0" step="0.1" value={shipping.width} onChange={(event) => setShipping((current) => ({ ...current, width: event.target.value }))} /><Field name="shippingHeight" label="Altura (cm)" type="number" min="0" step="0.1" value={shipping.height} onChange={(event) => setShipping((current) => ({ ...current, height: event.target.value }))} /><Field name="shippingOrigin" label="Origem" value={shipping.origin} onChange={(event) => setShipping((current) => ({ ...current, origin: event.target.value }))} /></div></Section>

    <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-3 rounded-xl border border-ink-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"><FormMessage state={state} /><SubmitButton pendingLabel="Salvando produto...">Salvar produto</SubmitButton></div>
  </form>;
}

/**
 * Como o preço vai aparecer na loja: o à vista e a chamada do cartão que o
 * site calcula com a tabela da maquininha (a mesma conta de `comParcelamento`,
 * em lib/catalog/database.ts). O lojista cadastra só o à vista; mudou o
 * preço, o parcelado acompanha. Linha inteira da grade: a caixa de um lado e
 * a tabela do simulador do outro, que precisa de largura para não rolar.
 *
 * Com variações, o preço do produto passa a ser o menor das opções ao salvar,
 * e cada opção tem o parcelado do próprio preço: a prévia pelo campo de preço
 * mostraria um número que o site não vai mostrar.
 */
function PrecoNoSite({ priceCents, parcelamento, comVariacoes }: { priceCents: number; parcelamento: ParcelamentoDaLoja; comVariacoes: boolean }) {
  const linhas = paymentLines(parcelamentoMaximo(priceCents, parcelamento));
  return <div className="grid gap-3 sm:col-span-2 lg:col-span-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
    <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-wide text-ink-500">Como aparece no site</p>
      {comVariacoes
        ? <p className="mt-2 text-xs leading-relaxed text-ink-600">Produto com variações: o site calcula o parcelado de cada opção pelo preço dela, com a tabela da maquininha de Configurações.</p>
        : priceCents > 0 ? <>
          <p className="mt-2"><strong className="text-xl text-ink-900">{formatPrice(priceCents)}</strong> <span className="text-xs font-bold text-ink-600">{linhas.pix}</span></p>
          {linhas.cartao && <p className="mt-0.5 text-xs text-ink-700">{linhas.cartao}</p>}
          {/* Nova aba: o cadastro pode ter edição ainda não salva. */}
          <p className="mt-2 text-[11px] leading-relaxed text-ink-500">Calculado sozinho com a tabela da maquininha. <a href="/painel/configuracoes#parcelamento" target="_blank" className="font-bold text-blue-700 underline underline-offset-2">Mudar as taxas<span className="sr-only"> (abre em nova aba)</span></a></p>
        </> : <p className="mt-2 text-xs text-ink-500">Preencha o preço à vista para ver o parcelado.</p>}
    </div>
    {!comVariacoes && priceCents > 0 && <InstallmentSimulator cents={priceCents} taxas={parcelamento.taxas} titulo="Tabela de parcelas deste preço" />}
  </div>;
}

function Section({ title, description, children, collapsible = false }: { title: string; description?: string; children: React.ReactNode; collapsible?: boolean }) { if (collapsible) return <details className="group rounded-2xl border border-ink-100 bg-white shadow-card"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden"><div><h2 className="text-base font-black">{title}</h2>{description && <p className="mt-1 text-xs text-ink-500">{description}</p>}</div><span className="rounded-full bg-ink-50 px-3 py-1 text-xs font-black text-ink-500 group-open:hidden">Abrir</span><span className="hidden rounded-full bg-ink-50 px-3 py-1 text-xs font-black text-ink-500 group-open:inline">Fechar</span></summary><div className="border-t border-ink-100 p-5">{children}</div></details>; return <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card"><h2 className="text-base font-black">{title}</h2>{description && <p className="mt-1 text-xs text-ink-500">{description}</p>}<div className="mt-5">{children}</div></section>; }
function Field({ name, label, hint, className = "", error, ...props }: { name: string; label: string; hint?: string; className?: string; error?: string[] } & React.InputHTMLAttributes<HTMLInputElement>) { return <label className={`${labelClass} ${className}`}>{label}<input name={name} className={fieldClass} {...props} />{hint && <span className="mt-1 block font-normal text-ink-400">{hint}</span>}{error && <ErrorText value={error} />}</label>; }
function Check({ name, label, checked }: { name: string; label: string; checked?: boolean }) { return <label className="flex items-center gap-2 text-sm font-semibold text-ink-700"><input type="checkbox" name={name} defaultChecked={checked} className="h-4 w-4 accent-gold-500" />{label}</label>; }
function ErrorText({ value }: { value: string[] }) { return <span className="mt-1 block font-normal text-red-600">{value[0]}</span>; }
function SearchLink({ label, href }: { label: string; href: string }) { return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white px-3 py-2 text-xs font-black text-blue-800 shadow-sm ring-1 ring-blue-200 hover:bg-blue-100">{label} ↗</a> : <span className="cursor-not-allowed rounded-lg bg-white/60 px-3 py-2 text-xs font-black text-blue-300">{label}</span>; }
/** Campos que a busca pode mudar, guardados para o "Desfazer preenchimento". */
interface FillSnapshot { name: string; slug: string; automaticSlug: boolean; brand: string; model: string; gtin: string; ncm: string; description: string; specs: string; tags: string; sourceUrl: string; weight: string; autoFilled: Record<string, string> }
function cents(value?: number | null) { return value == null ? "" : (value / 100).toFixed(2).replace(".", ","); }
function moneyInputToCents(value: string) { const raw = value.trim().replace(/\s/g, ""); if (!raw) return 0; const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw; const number = Number(normalized); return Number.isFinite(number) ? Math.round(number * 100) : 0; }
function slugify(value: string) { return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90); }
function buildTags(name: string, brand: string, model: string, category: string) { const values = [category, brand, model, ...name.split(/\s+/).filter((word) => word.length >= 4)]; return [...new Set(values.map((value) => normalize(value)).filter(Boolean))].slice(0, 12).join(", "); }
function buildDescription(name: string, brand: string, model: string, category: string) { const extras = [brand, model].filter((value) => value && !normalize(name).includes(normalize(value))); return `${name || "Este produto"}${extras.length ? ` ${extras.join(" ")}` : ""} faz parte da categoria ${category || "selecionada"}. Confira as características e especificações cadastradas antes da publicação.`; }
function googlePriceUrl(term: string) { return `https://www.google.com/search?q=${encodeURIComponent(`"${term}" preço`)}`; }
function googleShoppingUrl(term: string) { return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(term)}`; }
