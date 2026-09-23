import "server-only";

import { whatsappContacts, type WhatsappContact } from "@/config/site";
import { readCatalogState } from "@/lib/admin/catalog-store";
import { defaultStoreSettings } from "@/lib/admin/defaults";
import { contactableAttendants } from "@/lib/admin/distribution";
import { normalizeLeadDistributionMode } from "@/lib/admin/sellers";
import { contactsFor } from "@/lib/services/whatsapp";
import { categories as fallbackCategories } from "./categories";
import { lerParcelamento, parcelamentoMaximo, PARCELAMENTO_PADRAO, type ParcelamentoDaLoja } from "./parcelamento";
import { products as fallbackProducts } from "./products";
import type { Category, Product, ProductImage } from "./types";
import type { LeadDistributionMode, StoreSettings } from "@/lib/admin/types";

export interface PublicAttendants {
  /** Quem o cliente pode escolher no dialogo do WhatsApp, na ordem configurada. */
  contacts: WhatsappContact[];
  mode: LeadDistributionMode;
}

export async function loadCatalogProducts(): Promise<Product[]> {
  try {
    const state = await readCatalogState();
    const parcelamento = lerParcelamento(state.settings);
    if (!state.catalogEnabled) return fallbackProducts.map((product) => comParcelamento(product, parcelamento));
    const products = state.products.filter((product) => product.status === "active");
    return (products.length ? products.map((row) => toProduct(row as unknown as Record<string, unknown>)) : fallbackProducts)
      .map((product) => comParcelamento(product, parcelamento));
  } catch { return fallbackProducts.map((product) => comParcelamento(product, PARCELAMENTO_PADRAO)); }
}

/**
 * O parcelado de cada produto e de cada opção, calculado sobre o preço à
 * vista com a tabela da maquininha. É o único lugar que o define: a coluna
 * `card_installment` do banco (digitada à mão, que ficava velha quando o
 * preço mudava) não é mais lida pela loja.
 */
function comParcelamento(product: Product, parcelamento: ParcelamentoDaLoja): Product {
  return {
    ...product,
    cardInstallment: parcelamentoMaximo(product.price, parcelamento) ?? undefined,
    ...(product.variantOptions
      ? {
          variantOptions: product.variantOptions.map((opcao) => ({
            ...opcao,
            cardInstallment: parcelamentoMaximo(opcao.price, parcelamento) ?? undefined,
          })),
        }
      : {}),
  };
}

export async function loadCatalogCategories(): Promise<Category[]> {
  try {
    const state = await readCatalogState();
    if (!state.catalogEnabled) return fallbackCategories;
    const categories = state.categories.filter((category) => category.active).sort((a, b) => a.sort_order - b.sort_order);
    return categories.length ? categories.map((row) => ({ id: row.id, name: row.name, slug: row.slug, description: row.description, icon: row.icon, order: row.sort_order, inMainMenu: row.in_main_menu })) : fallbackCategories;
  } catch { return fallbackCategories; }
}

/**
 * Tabela da maquininha e chamada das Configurações, para o que calcula no
 * navegador. As páginas que mostram parcelas (produto, carrinho, checkouts)
 * leem aqui no próprio segmento: o layout raiz não é buscado de novo na
 * navegação dentro do site, e a tabela dele ficaria velha até o recarregamento.
 */
export async function loadParcelamento(): Promise<ParcelamentoDaLoja> {
  return lerParcelamento(await loadPublicStoreSettings());
}

export async function loadPublicStoreSettings(): Promise<StoreSettings> {
  try {
    return { ...defaultStoreSettings, ...(await readCatalogState()).settings };
  } catch { return defaultStoreSettings; }
}

/**
 * Atendentes que o site mostra, derivados do mesmo cadastro que o painel usa
 * nos pedidos. O botao de WhatsApp nunca pode ficar sem destino: se nenhum
 * atendente recebe atendimentos, mostra os ativos; se nao ha ativos ou o
 * catalogo nao pode ser lido, volta para a lista estatica de config/site.
 */
export async function loadPublicAttendants(): Promise<PublicAttendants> {
  const fallback: PublicAttendants = { contacts: [...whatsappContacts], mode: "customer_choice" };
  try {
    const state = await readCatalogState();
    const settings = { ...defaultStoreSettings, ...state.settings };
    const sellers = state.operations.sellers;
    const visiveis = contactableAttendants(sellers, settings);
    if (!visiveis.length) return { ...fallback, mode: normalizeLeadDistributionMode(settings.leadDistributionMode) };
    return { contacts: contactsFor(settings, visiveis), mode: normalizeLeadDistributionMode(settings.leadDistributionMode) };
  } catch (error) {
    console.warn("Atendentes indisponiveis; usando a lista estatica do site.", error);
    return fallback;
  }
}

function toProduct(row: Record<string, unknown>): Product {
  const imageRows = (Array.isArray(row.product_images) ? row.product_images : []) as Array<Record<string, unknown>>;
  // Só as opcoes ativas chegam na loja: opcao desligada e cor que saiu de
  // linha, nao pode aparecer para o cliente escolher.
  const variantRows = (Array.isArray(row.product_variants) ? row.product_variants : []) as Array<Record<string, unknown>>;
  const variantOptions = variantRows
    .filter((item) => item.active !== false)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    .map((item) => ({
      id: String(item.id), label: String(item.label), sku: String(item.sku),
      price: Number(item.price_cents), stock: Number(item.stock),
      // So aponta para foto que ainda existe no produto: imagem removida
      // depois de marcada cairia num link morto na vitrine.
      ...(item.image_src && imageRows.some((img) => img.src === item.image_src) ? { image: String(item.image_src) } : {}),
    }));
  const images: ProductImage[] = imageRows.sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) || Number(a.sort_order) - Number(b.sort_order)).map((image) => ({ src: String(image.src), alt: String(image.alt ?? row.name) }));
  const shipping = (row.shipping ?? {}) as Product["shipping"];
  return {
    id: String(row.id), ...(row.external_id != null ? { externalId: Number(row.external_id) } : {}), name: String(row.name), slug: String(row.slug), description: String(row.description ?? ""), price: Number(row.price_cents), ...(row.old_price_cents != null ? { oldPrice: Number(row.old_price_cents) } : {}), categoryId: String(row.category_id), ...(row.brand ? { brand: String(row.brand) } : {}), sku: String(row.sku), stock: Number(row.stock), images,
    ...(variantOptions.length ? { variantOptions, variantAxis: String(row.variant_axis ?? "Variação") } : {}),
    variants: Array.isArray(row.variants) ? row.variants as Product["variants"] : [], specifications: Array.isArray(row.specifications) ? row.specifications as Product["specifications"] : [],
    shipping: { weight: Number(shipping?.weight ?? 0), dimensions: { length: Number(shipping?.dimensions?.length ?? 0), width: Number(shipping?.dimensions?.width ?? 0), height: Number(shipping?.dimensions?.height ?? 0) }, origin: String(shipping?.origin ?? "Minas Gerais") },
    ...(row.rating != null ? { rating: Number(row.rating) } : {}), ...(row.review_count != null ? { reviewCount: Number(row.review_count) } : {}), ...(row.sold_count != null ? { soldCount: Number(row.sold_count) } : {}), isFeatured: Boolean(row.is_featured), isBestSeller: Boolean(row.is_best_seller), isOffer: Boolean(row.is_offer), isExclusive: Boolean(row.is_exclusive), tags: Array.isArray(row.tags) ? row.tags.map(String) : [], dataSource: (row.data_source ?? "loja-verified") as Product["dataSource"], ...(row.source_url ? { sourceUrl: String(row.source_url) } : {}), ...(row.seller_note ? { sellerNote: String(row.seller_note) } : {}), ...(row.published_at ? { publishedAt: String(row.published_at) } : {}), ...(row.last_stock_entry_at ? { lastStockEntryAt: String(row.last_stock_entry_at) } : {}), ...(row.last_sale_at ? { lastSaleAt: String(row.last_sale_at) } : {}), heroEnabled: row.hero_enabled !== false, heroPriority: Number(row.hero_priority ?? 0),
  };
}
