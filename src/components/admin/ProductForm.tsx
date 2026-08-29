"use client";

import { useActionState, useMemo, useState } from "react";
import { saveProductAction } from "@/app/painel/actions";
import type { CategorySkuChoice } from "@/lib/admin/sku";
import type { AdminCategoryRow, AdminProductRow, ProductAssistTemplate, ProductOperationalMeta } from "@/lib/admin/types";
import { formatPrice, normalize } from "@/lib/utils/format";
import { onlyDigits } from "@/lib/utils/validators";
import { FormMessage, SubmitButton, fieldClass, labelClass } from "./FormControls";

interface ProductFormProps {
  product?: AdminProductRow | null;
  categories: AdminCategoryRow[];
  operationalMeta?: ProductOperationalMeta;
  initialCategoryId?: string;
  skuChoices?: CategorySkuChoice[];
  templates?: ProductAssistTemplate[];
}

export function ProductForm({ product, categories, operationalMeta, initialCategoryId = "", skuChoices = [], templates = [] }: ProductFormProps) {
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
  const [description, setDescription] = useState(product?.description ?? "");
  const [tags, setTags] = useState(product?.tags.join(", ") ?? "");
  const [specs, setSpecs] = useState(product?.specifications.map((item) => `${item.label}: ${item.value}`).join("\n") ?? "");
  const [variants, setVariants] = useState(product?.variants.map((item) => `${item.name}: ${item.options.join(", ")}`).join("\n") ?? "");
  const [sellerNote, setSellerNote] = useState(product?.seller_note ?? "");
  const [cost, setCost] = useState(cents(operationalMeta?.cost_cents));
  const [price, setPrice] = useState(cents(product?.price_cents));
  const [shipping, setShipping] = useState({ weight: String(product?.shipping.weight ?? 0), length: String(product?.shipping.dimensions.length ?? 0), width: String(product?.shipping.dimensions.width ?? 0), height: String(product?.shipping.dimensions.height ?? 0), origin: product?.shipping.origin ?? "Minas Gerais" });
  const [templateQuery, setTemplateQuery] = useState("");
  const [assistMessage, setAssistMessage] = useState("");

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
    setAssistMessage("Sugestões aplicadas. Revise os textos antes de salvar.");
  }
  function copyTemplate(template: ProductAssistTemplate) {
    changeCategory(template.category_id); setBrand(template.brand); setDescription(template.description); setTags(template.tags.join(", "));
    setSpecs(template.specifications.map((item) => `${item.label}: ${item.value}`).join("\n"));
    setVariants(template.variants.map((item) => `${item.name}: ${item.options.join(", ")}`).join("\n")); setSellerNote(template.seller_note);
    setShipping({ weight: String(template.shipping.weight), length: String(template.shipping.dimensions.length), width: String(template.shipping.dimensions.width), height: String(template.shipping.dimensions.height), origin: template.shipping.origin });
    setTemplateQuery(""); setAssistMessage(`Estrutura copiada de “${template.name}”. Nome, modelo, EAN, preço, custo e estoque não foram copiados.`);
  }

  return <form action={action} className="space-y-6">
    <input type="hidden" name="id" value={product?.id ?? ""} /><input type="hidden" name="skuMode" value={automaticSku ? "auto" : "manual"} />

    <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Assistente de cadastro</p><h2 className="mt-1 text-lg font-black text-ink-900">Preencher mais rápido</h2><p className="mt-1 text-xs text-ink-500">Use sugestões e modelos internos; nada é publicado sem você salvar.</p></div><button type="button" onClick={applySuggestions} disabled={!name.trim()} className="rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-black text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40">Preencher sugestões</button></div>
      {!product && <div className="relative mt-4 max-w-2xl"><label className={labelClass}>Copiar estrutura de um produto semelhante<input value={templateQuery} onChange={(event) => setTemplateQuery(event.target.value)} placeholder="Busque por nome, SKU, marca ou categoria" className={fieldClass} /></label>{templateQuery && <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl">{templateMatches.map((template) => <button key={template.id} type="button" onClick={() => copyTemplate(template)} className="flex w-full items-center justify-between gap-4 border-b border-ink-100 px-4 py-3 text-left last:border-0 hover:bg-blue-50"><span><strong className="block text-sm">{template.name}</strong><small className="text-ink-500">{template.category_name} · SKU {template.sku}</small></span><span className="shrink-0 text-[10px] font-black uppercase text-blue-700">Usar modelo</span></button>)}{!templateMatches.length && <p className="px-4 py-5 text-center text-sm text-ink-500">Nenhum produto semelhante encontrado.</p>}</div>}</div>}
      {suggestedBrand && !brand && <button type="button" onClick={() => setBrand(suggestedBrand)} className="mt-3 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-800">Usar marca sugerida: {suggestedBrand}</button>}
      {assistMessage && <p role="status" className="mt-3 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-xs leading-relaxed text-gold-900">{assistMessage}</p>}
    </section>

    <Section title="Informações principais" description="Comece pelos dados que identificam exatamente o produto."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field name="name" label="Nome do produto" value={name} onChange={(event) => changeName(event.target.value)} required className="sm:col-span-2 lg:col-span-3" error={state.errors?.name} />
      <label className={labelClass}>Marca<input name="brand" value={brand} onChange={(event) => setBrand(event.target.value)} list="product-brand-options" className={fieldClass} /><datalist id="product-brand-options">{knownBrands.map((item) => <option key={item} value={item} />)}</datalist></label>
      <Field name="model" label="Modelo" value={model} onChange={(event) => setModel(event.target.value)} maxLength={100} placeholder="Ex.: 50UA8550PSA" hint="Ajuda a encontrar o produto exato na internet." />
      <Field name="gtin" label="EAN / GTIN" value={gtin} onChange={(event) => setGtin(onlyDigits(event.target.value).slice(0, 14))} inputMode="numeric" maxLength={14} placeholder="Código de barras" hint="Aceita GTIN-8, UPC, EAN-13 ou GTIN-14." />
      <label className={labelClass}>Categoria<select name="categoryId" value={categoryId} onChange={(event) => changeCategory(event.target.value)} required className={fieldClass}><option value="">Selecione</option>{categories.filter((item) => item.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className={labelClass}>SKU<div className="relative"><input name="sku" value={sku} onChange={(event) => { setSku(event.target.value.toUpperCase()); setAutomaticSku(false); }} required className={`${fieldClass} pr-24 font-mono font-bold`} /><span className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[9px] font-black uppercase ${automaticSku ? "bg-green-50 text-green-700" : "bg-ink-50 text-ink-500"}`}>{automaticSku ? "Automático" : "Manual"}</span></div>{!product && choicesByCategory.get(categoryId) && <button type="button" onClick={() => { setSku(choicesByCategory.get(categoryId)!.nextSku); setAutomaticSku(true); }} className="mt-1 text-left text-[11px] font-bold text-blue-700 hover:underline">Usar próximo código: {choicesByCategory.get(categoryId)!.nextSku}</button>}{state.errors?.sku && <ErrorText value={state.errors.sku} />}</label>
      <label className={labelClass}>Endereço (slug)<div className="relative"><input name="slug" value={slug} onChange={(event) => { setSlug(slugify(event.target.value)); setAutomaticSlug(false); }} required className={`${fieldClass} pr-24`} /><span className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[9px] font-black uppercase ${automaticSlug ? "bg-green-50 text-green-700" : "bg-ink-50 text-ink-500"}`}>{automaticSlug ? "Automático" : "Manual"}</span></div>{!product && <button type="button" onClick={() => { setSlug(slugify(name)); setAutomaticSlug(true); }} className="mt-1 text-[11px] font-bold text-blue-700 hover:underline">Gerar novamente pelo nome</button>}{state.errors?.slug && <ErrorText value={state.errors.slug} />}</label>
      <Field name="ncm" label="NCM" inputMode="numeric" maxLength={8} defaultValue={operationalMeta?.ncm ?? ""} hint="Opcional; somente os 8 dígitos." />
      <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>Descrição<textarea name="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} required className={fieldClass} /><button type="button" onClick={() => { setDescription(buildDescription(name, brand, model, categoryNames.get(categoryId) ?? "")); setAssistMessage("Descrição-base criada. Revise antes de publicar."); }} disabled={!name.trim()} className="mt-1 text-[11px] font-bold text-blue-700 hover:underline disabled:opacity-40">Montar descrição-base</button>{state.errors?.description && <ErrorText value={state.errors.description} />}</label>
    </div></Section>

    <Section title="Preço, estoque e publicação" description="Novos produtos já ficam publicados por padrão. Você pode escolher rascunho quando quiser preparar o cadastro antes de mostrar na loja."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field name="cost" label="Custo (R$)" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} hint="Uso interno; não aparece na loja." /><Field name="price" label="Preço atual (R$)" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required error={state.errors?.priceCents} /><Field name="oldPrice" label="Preço anterior (R$)" inputMode="decimal" defaultValue={cents(product?.old_price_cents)} hint="Opcional; deve ser maior." />
      {product ? <label className={labelClass}>Estoque atual<input value={product.stock} disabled className={`${fieldClass} bg-ink-50`} /><input type="hidden" name="stock" value={product.stock} /><span className="mt-1 block font-normal text-ink-400">Use a tela Estoque para alterar.</span></label> : <Field name="stock" label="Estoque inicial" type="number" min="0" defaultValue={0} required />}
      <Field name="lowStockThreshold" label="Avisar estoque baixo em" type="number" min="0" defaultValue={product?.low_stock_threshold ?? 3} required /><label className={labelClass}>Status<select name="status" defaultValue={product?.status ?? "active"} className={fieldClass}><option value="active">Publicado</option><option value="draft">Rascunho</option><option value="archived">Arquivado</option></select></label>
      <div className={`rounded-xl border p-4 sm:col-span-2 ${costCents > 0 && priceCents > 0 ? grossProfit >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50" : "border-ink-200 bg-ink-50"}`}><p className="text-[10px] font-black uppercase tracking-wide text-ink-500">Margem bruta estimada</p>{costCents > 0 && priceCents > 0 ? <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><strong className={`text-xl ${grossProfit >= 0 ? "text-green-800" : "text-red-700"}`}>{formatPrice(grossProfit)}</strong><span className="ml-2 text-sm font-bold text-ink-600">{marginPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span></div><small className="text-ink-500">Antes de impostos, frete e comissão</small></div> : <p className="mt-2 text-xs text-ink-500">Preencha custo e preço para calcular.</p>}</div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:col-span-2 lg:col-span-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black text-blue-950">Comparativo de preços</p><p className="mt-1 text-xs text-blue-700">Pesquisa atual: {comparisonTerm || "informe nome, modelo ou EAN"}</p></div><div className="flex flex-wrap gap-2"><SearchLink label="Google Shopping" href={comparisonTerm ? googleShoppingUrl(comparisonTerm) : ""} /><SearchLink label="Buscar preços no Google" href={comparisonTerm ? googlePriceUrl(comparisonTerm) : ""} /></div></div><p className="mt-2 text-[10px] leading-relaxed text-blue-600">Os resultados abrem no Google para conferência. O painel não copia preços nem altera sua oferta automaticamente.</p></div>
      <div className="flex flex-wrap gap-4 sm:col-span-2 lg:col-span-3 lg:pt-2"><Check name="isFeatured" label="Destaque na home" checked={product?.is_featured} /><Check name="isOffer" label="Oferta" checked={product?.is_offer} /><Check name="isBestSeller" label="Seleção mais vendidos" checked={product?.is_best_seller} /><Check name="isExclusive" label="Exclusivo Dom Guima" checked={product?.is_exclusive} /><Check name="heroEnabled" label="Pode aparecer no banner" checked={product?.hero_enabled ?? true} /></div><Field name="heroPriority" label="Prioridade no banner" type="number" min="-100" max="100" defaultValue={product?.hero_priority ?? 0} hint="0 = automático; use de -100 a 100 para ajustar." />
    </div></Section>

    <Section title="Detalhes comerciais" description="Abra somente quando precisar revisar textos e especificações." collapsible><div className="grid gap-4 sm:grid-cols-2"><label className={`${labelClass} sm:col-span-2`}>Palavras-chave<textarea name="tags" value={tags} onChange={(event) => setTags(event.target.value)} rows={2} className={fieldClass} /><button type="button" onClick={() => setTags(buildTags(name, brand, model, categoryNames.get(categoryId) ?? ""))} className="mt-1 text-[11px] font-bold text-blue-700 hover:underline">Sugerir palavras-chave</button></label><Field name="sourceUrl" label="Link do anúncio original" type="url" defaultValue={product?.source_url ?? ""} /><Field name="sellerNote" label="Observação do vendedor" value={sellerNote} onChange={(event) => setSellerNote(event.target.value)} /><label className={labelClass}>Especificações<textarea name="specifications" value={specs} onChange={(event) => setSpecs(event.target.value)} rows={7} className={fieldClass} placeholder={'Potência: 1500W\nCor: Preto'} /><span className="mt-1 block font-normal text-ink-400">Uma por linha, no formato Campo: Valor.</span></label><label className={labelClass}>Variações<textarea name="variants" value={variants} onChange={(event) => setVariants(event.target.value)} rows={7} className={fieldClass} placeholder="Voltagem: 110V, 220V" /><span className="mt-1 block font-normal text-ink-400">Uma por linha; opções separadas por vírgula.</span></label></div></Section>

    <Section title="Envio" description="Peso e dimensões podem ser copiados de um produto semelhante, mas devem ser conferidos." collapsible><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Field name="shippingWeight" label="Peso (gramas)" type="number" min="0" value={shipping.weight} onChange={(event) => setShipping((current) => ({ ...current, weight: event.target.value }))} /><Field name="shippingLength" label="Comprimento (cm)" type="number" min="0" step="0.1" value={shipping.length} onChange={(event) => setShipping((current) => ({ ...current, length: event.target.value }))} /><Field name="shippingWidth" label="Largura (cm)" type="number" min="0" step="0.1" value={shipping.width} onChange={(event) => setShipping((current) => ({ ...current, width: event.target.value }))} /><Field name="shippingHeight" label="Altura (cm)" type="number" min="0" step="0.1" value={shipping.height} onChange={(event) => setShipping((current) => ({ ...current, height: event.target.value }))} /><Field name="shippingOrigin" label="Origem" value={shipping.origin} onChange={(event) => setShipping((current) => ({ ...current, origin: event.target.value }))} /></div></Section>

    <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-3 rounded-xl border border-ink-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"><FormMessage state={state} /><SubmitButton pendingLabel="Salvando produto...">Salvar produto</SubmitButton></div>
  </form>;
}

function Section({ title, description, children, collapsible = false }: { title: string; description?: string; children: React.ReactNode; collapsible?: boolean }) { if (collapsible) return <details className="group rounded-2xl border border-ink-100 bg-white shadow-card"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden"><div><h2 className="text-base font-black">{title}</h2>{description && <p className="mt-1 text-xs text-ink-500">{description}</p>}</div><span className="rounded-full bg-ink-50 px-3 py-1 text-xs font-black text-ink-500 group-open:hidden">Abrir</span><span className="hidden rounded-full bg-ink-50 px-3 py-1 text-xs font-black text-ink-500 group-open:inline">Fechar</span></summary><div className="border-t border-ink-100 p-5">{children}</div></details>; return <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card"><h2 className="text-base font-black">{title}</h2>{description && <p className="mt-1 text-xs text-ink-500">{description}</p>}<div className="mt-5">{children}</div></section>; }
function Field({ name, label, hint, className = "", error, ...props }: { name: string; label: string; hint?: string; className?: string; error?: string[] } & React.InputHTMLAttributes<HTMLInputElement>) { return <label className={`${labelClass} ${className}`}>{label}<input name={name} className={fieldClass} {...props} />{hint && <span className="mt-1 block font-normal text-ink-400">{hint}</span>}{error && <ErrorText value={error} />}</label>; }
function Check({ name, label, checked }: { name: string; label: string; checked?: boolean }) { return <label className="flex items-center gap-2 text-sm font-semibold text-ink-700"><input type="checkbox" name={name} defaultChecked={checked} className="h-4 w-4 accent-gold-500" />{label}</label>; }
function ErrorText({ value }: { value: string[] }) { return <span className="mt-1 block font-normal text-red-600">{value[0]}</span>; }
function SearchLink({ label, href }: { label: string; href: string }) { return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white px-3 py-2 text-xs font-black text-blue-800 shadow-sm ring-1 ring-blue-200 hover:bg-blue-100">{label} ↗</a> : <span className="cursor-not-allowed rounded-lg bg-white/60 px-3 py-2 text-xs font-black text-blue-300">{label}</span>; }
function cents(value?: number | null) { return value == null ? "" : (value / 100).toFixed(2).replace(".", ","); }
function moneyInputToCents(value: string) { const raw = value.trim().replace(/\s/g, ""); if (!raw) return 0; const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw; const number = Number(normalized); return Number.isFinite(number) ? Math.round(number * 100) : 0; }
function slugify(value: string) { return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90); }
function buildTags(name: string, brand: string, model: string, category: string) { const values = [category, brand, model, ...name.split(/\s+/).filter((word) => word.length >= 4)]; return [...new Set(values.map((value) => normalize(value)).filter(Boolean))].slice(0, 12).join(", "); }
function buildDescription(name: string, brand: string, model: string, category: string) { const extras = [brand, model].filter((value) => value && !normalize(name).includes(normalize(value))); return `${name || "Este produto"}${extras.length ? ` ${extras.join(" ")}` : ""} faz parte da categoria ${category || "selecionada"}. Confira as características e especificações cadastradas antes da publicação.`; }
function googlePriceUrl(term: string) { return `https://www.google.com/search?q=${encodeURIComponent(`"${term}" preço`)}`; }
function googleShoppingUrl(term: string) { return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(term)}`; }
