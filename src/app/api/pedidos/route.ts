import { NextResponse } from "next/server";
import { z } from "zod";
import { mutateCatalogState } from "@/lib/admin/catalog-store";
import { createPendingSalesOrder, OrderOperationError } from "@/lib/admin/orders";
import { isValidDocument, isValidPhone, onlyDigits } from "@/lib/utils/validators";

const publicOrderInput = z.object({
  requestId: z.string().regex(/^[a-zA-Z0-9_-]{8,120}$/),
  website: z.string().max(0).optional(),
  customer: z.object({
    name: z.string().trim().min(3).max(140),
    cpf: z.string().transform(onlyDigits).refine(isValidDocument, "CPF ou CNPJ invalido."),
    email: z.string().trim().email("E-mail invalido.").max(180),
    phone: z.string().trim().refine(isValidPhone, "Telefone invalido."),
    cep: z.string().transform(onlyDigits).refine((value) => value.length === 8, "CEP invalido."),
    street: z.string().trim().min(2).max(180),
    number: z.string().trim().min(1).max(30),
    complement: z.string().trim().max(100),
    neighborhood: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  }),
  notes: z.string().trim().max(500),
  paymentMethod: z.enum(["pix", "credit_card", "debit_card", "boleto", "cash_on_delivery", "to_confirm"]),
  deliveryMethod: z.enum(["uberlandia_delivery", "shipping_to_confirm"]),
  items: z.array(z.object({
    productId: z.string().trim().min(1).max(200),
    quantity: z.number().int().min(1).max(100),
    variant: z.string().trim().max(100).nullable().optional(),
  })).min(1).max(50),
});

const requestLog = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1_000;
const MAX_REQUESTS = 12;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ message: "Origem da solicitacao invalida." }, { status: 403 });
  if (isRateLimited(request)) return NextResponse.json({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Nao conseguimos ler os dados do pedido." }, { status: 400 });
  }

  const parsed = publicOrderInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Revise os dados do pedido." }, { status: 400 });
  if (parsed.data.paymentMethod === "cash_on_delivery" && !isUberlandia(parsed.data.customer.city)) {
    return NextResponse.json({ message: "Pagar no ato da entrega está disponível somente para Uberlândia." }, { status: 400 });
  }
  if (parsed.data.deliveryMethod === "uberlandia_delivery" && !isUberlandia(parsed.data.customer.city)) {
    return NextResponse.json({ message: "A entrega local está disponível somente para Uberlândia." }, { status: 400 });
  }

  try {
    let created: ReturnType<typeof createPendingSalesOrder> | null = null;
    await mutateCatalogState((state) => {
      created = createPendingSalesOrder(state, parsed.data);
    });
    return NextResponse.json({ ok: true, orderId: created!.id, orderNumber: created!.number }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderOperationError) return NextResponse.json({ message: error.message }, { status: 409 });
    return NextResponse.json({ message: "Nao foi possivel registrar o pedido agora. Tente novamente em instantes." }, { status: 500 });
  }
}

function isUberlandia(city: string): boolean {
  return city.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === "uberlandia";
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
    return Boolean(host && originUrl.host === host);
  } catch {
    return false;
  }
}

function isRateLimited(request: Request): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const current = requestLog.get(ip);
  if (!current || current.resetAt <= now) {
    requestLog.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS;
}
