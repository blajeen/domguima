"use client";

import { useActionState } from "react";
import { saveProductAction } from "@/app/painel/actions";
import type { AdminCategoryRow, AdminProductRow, ProductOperationalMeta } from "@/lib/admin/types";
import { FormMessage, SubmitButton, fieldClass, labelClass } from "./FormControls";

export function ProductForm({ product, categories, operationalMeta }: { product?: AdminProductRow | null; categories: AdminCategoryRow[]; operationalMeta?: ProductOperationalMeta }) {
  const [state, action] = useActionState(saveProductAction, {});
  const specs = product?.specifications.map((item) => `${item.label}: ${item.value}`).join("\n") ?? "";
  const variants = product?.variants.map((item) => `${item.name}: ${item.options.join(", ")}`).join("\n") ?? "";
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={product?.id ?? ""} />
      <Section title="Informacoes principais" description="Campos usados na busca e na pagina publica.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="name" label="Nome do produto" defaultValue={product?.name} required className="sm:col-span-2" error={state.errors?.name} />
          <Field name="slug" label="Endereco (slug)" defaultValue={product?.slug} required hint="Ex.: smart-tv-samsung-50" error={state.errors?.slug} />
          <Field name="sku" label="SKU" defaultValue={product?.sku} required error={state.errors?.sku} />
          <Field name="ncm" label="NCM" inputMode="numeric" maxLength={8} defaultValue={operationalMeta?.ncm ?? ""} hint="Opcional; somente os 8 dígitos." />
          <Field name="brand" label="Marca" defaultValue={product?.brand ?? ""} />
          <label className={labelClass}>Categoria
            <select name="categoryId" defaultValue={product?.category_id} required className={fieldClass}>
              <option value="">Selecione</option>
              {categories.filter((item) => item.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>Descricao
            <textarea name="description" defaultValue={product?.description} rows={6} required className={fieldClass} />
            {state.errors?.description && <ErrorText value={state.errors.description} />}
          </label>
        </div>
      </Section>

      <Section title="Preco, estoque e publicacao" description="Alteracoes de estoque posteriores devem ser feitas pela tela Estoque.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field name="cost" label="Custo (R$)" inputMode="decimal" defaultValue={cents(operationalMeta?.cost_cents)} hint="Uso interno; não aparece na loja." />
          <Field name="price" label="Preco atual (R$)" inputMode="decimal" defaultValue={cents(product?.price_cents)} required error={state.errors?.priceCents} />
          <Field name="oldPrice" label="Preco anterior (R$)" inputMode="decimal" defaultValue={cents(product?.old_price_cents)} hint="Opcional; deve ser maior." />
          {product ? <label className={labelClass}>Estoque atual<input value={product.stock} disabled className={`${fieldClass} bg-ink-50`} /><input type="hidden" name="stock" value={product.stock} /><span className="mt-1 block font-normal text-ink-400">Use a tela Estoque para alterar e registrar o motivo.</span></label> : <Field name="stock" label="Estoque inicial" type="number" min="0" defaultValue={0} required />}
          <Field name="lowStockThreshold" label="Avisar estoque baixo em" type="number" min="0" defaultValue={product?.low_stock_threshold ?? 3} required />
          <label className={labelClass}>Status
            <select name="status" defaultValue={product?.status ?? "draft"} className={fieldClass}>
              <option value="draft">Rascunho</option>
              <option value="active">Publicado</option>
              <option value="archived">Arquivado</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-4 sm:col-span-2 lg:col-span-3 lg:pt-7">
            <Check name="isFeatured" label="Destaque na home" checked={product?.is_featured} />
            <Check name="isOffer" label="Oferta" checked={product?.is_offer} />
            <Check name="isBestSeller" label="Selecao mais vendidos" checked={product?.is_best_seller} />
            <Check name="isExclusive" label="Exclusivo Dom Guima" checked={product?.is_exclusive} />
            <Check name="heroEnabled" label="Pode aparecer no banner" checked={product?.hero_enabled ?? true} />
          </div>
          <Field name="heroPriority" label="Prioridade no banner" type="number" min="-100" max="100" defaultValue={product?.hero_priority ?? 0} hint="0 = automatico; use de -100 a 100 para ajustar." />
        </div>
      </Section>

      <Section title="Detalhes comerciais">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="tags" label="Palavras-chave" defaultValue={product?.tags.join(", ")} hint="Separadas por virgula." className="sm:col-span-2" />
          <Field name="sourceUrl" label="Link do anuncio original" type="url" defaultValue={product?.source_url ?? ""} />
          <Field name="sellerNote" label="Observacao do vendedor" defaultValue={product?.seller_note ?? ""} />
          <label className={labelClass}>Especificacoes
            <textarea name="specifications" defaultValue={specs} rows={7} className={fieldClass} placeholder={'Potencia: 1500W\nCor: Preto'} />
            <span className="mt-1 block font-normal text-ink-400">Uma por linha, no formato Campo: Valor.</span>
          </label>
          <label className={labelClass}>Variacoes
            <textarea name="variants" defaultValue={variants} rows={7} className={fieldClass} placeholder="Voltagem: 110V, 220V" />
            <span className="mt-1 block font-normal text-ink-400">Uma por linha; opcoes separadas por virgula.</span>
          </label>
        </div>
      </Section>

      <Section title="Envio">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field name="shippingWeight" label="Peso (gramas)" type="number" min="0" defaultValue={product?.shipping.weight ?? 0} />
          <Field name="shippingLength" label="Comprimento (cm)" type="number" min="0" step="0.1" defaultValue={product?.shipping.dimensions.length ?? 0} />
          <Field name="shippingWidth" label="Largura (cm)" type="number" min="0" step="0.1" defaultValue={product?.shipping.dimensions.width ?? 0} />
          <Field name="shippingHeight" label="Altura (cm)" type="number" min="0" step="0.1" defaultValue={product?.shipping.dimensions.height ?? 0} />
          <Field name="shippingOrigin" label="Origem" defaultValue={product?.shipping.origin ?? "Minas Gerais"} />
        </div>
      </Section>

      <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-3 rounded-xl border border-ink-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <FormMessage state={state} />
        <SubmitButton pendingLabel="Salvando produto...">Salvar produto</SubmitButton>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card"><h2 className="text-base font-black">{title}</h2>{description && <p className="mt-1 text-xs text-ink-500">{description}</p>}<div className="mt-5">{children}</div></section>;
}

function Field({ name, label, hint, className = "", error, ...props }: { name: string; label: string; hint?: string; className?: string; error?: string[] } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className={`${labelClass} ${className}`}>{label}<input name={name} className={fieldClass} {...props} />{hint && <span className="mt-1 block font-normal text-ink-400">{hint}</span>}{error && <ErrorText value={error} />}</label>;
}

function Check({ name, label, checked }: { name: string; label: string; checked?: boolean }) {
  return <label className="flex items-center gap-2 text-sm font-semibold text-ink-700"><input type="checkbox" name={name} defaultChecked={checked} className="h-4 w-4 accent-gold-500" />{label}</label>;
}

function ErrorText({ value }: { value: string[] }) { return <span className="mt-1 block font-normal text-red-600">{value[0]}</span>; }
function cents(value?: number | null) { return value == null ? "" : (value / 100).toFixed(2).replace(".", ","); }
