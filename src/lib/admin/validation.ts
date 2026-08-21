import { z } from "zod";

const optionalUrl = z.string().trim().refine(
  (value) => value === "" || /^https?:\/\//i.test(value),
  "Informe uma URL completa, iniciando com http:// ou https://.",
);

export const productSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(3, "Informe um nome com pelo menos 3 caracteres."),
  slug: z.string().trim().min(3).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minusculas, numeros e hifens."),
  sku: z.string().trim().min(2, "Informe o SKU."),
  brand: z.string().trim(),
  categoryId: z.string().trim().min(1, "Escolha uma categoria."),
  description: z.string().trim().min(20, "A descricao precisa ter pelo menos 20 caracteres."),
  priceCents: z.number().int().positive("O preco precisa ser maior que zero."),
  oldPriceCents: z.number().int().positive().nullable(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0),
  status: z.enum(["draft", "active", "archived"]),
  tags: z.array(z.string()),
  sourceUrl: optionalUrl,
  sellerNote: z.string().trim(),
  shippingWeight: z.number().int().min(0),
  shippingLength: z.number().min(0),
  shippingWidth: z.number().min(0),
  shippingHeight: z.number().min(0),
  shippingOrigin: z.string().trim().min(2),
  isFeatured: z.boolean(),
  isBestSeller: z.boolean(),
  isOffer: z.boolean(),
  isExclusive: z.boolean(),
  heroEnabled: z.boolean(),
  heroPriority: z.number().int().min(-100).max(100),
}).superRefine((value, context) => {
  if (value.oldPriceCents !== null && value.oldPriceCents <= value.priceCents) {
    context.addIssue({ code: "custom", path: ["oldPriceCents"], message: "O preco anterior deve ser maior que o atual." });
  }
  if (value.isOffer && value.oldPriceCents === null) {
    context.addIssue({ code: "custom", path: ["oldPriceCents"], message: "Uma oferta precisa ter preco anterior." });
  }
});

export const categorySchema = z.object({
  id: z.string().trim().min(2).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10),
  icon: z.string().trim().min(1),
  sortOrder: z.number().int().min(0),
  inMainMenu: z.boolean(),
  active: z.boolean(),
});

export function moneyToCents(value: FormDataEntryValue | null): number {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  return Math.round(Number(normalized) * 100);
}

export function numberFrom(value: FormDataEntryValue | null): number {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
