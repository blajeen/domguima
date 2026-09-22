import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { readCatalogState } from "@/lib/admin/catalog-store";
import { registerSiteOrderLead } from "@/lib/admin/lead-orders";
import { attributionFromCookie, ORIGIN_COOKIE } from "@/lib/admin/leads";
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
    variantId: z.string().trim().max(120).nullable().optional(),
  })).min(1).max(50),
});

const requestLog = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1_000;
const MAX_REQUESTS = 12;

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ message: "Origem da solicitacao invalida." }, { status: 403 });
  if (isRateLimited(request)) return NextResponse.json({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Nao conseguimos ler os dados do pedido." }, { status: 400 });
  }

  const parsed = publicOrderInput.safeParse(body);
  if (!parsed.success) {
    // Só devolvemos a mensagem quando ela é nossa (escrita em português no
    // schema). As mensagens automáticas do Zod são técnicas e em inglês —
    // não servem para o cliente e expõem a forma interna do payload.
    const issue = parsed.error.issues[0];
    const propria = issue?.message && !/^Invalid|^Required|^Expected|^Too /i.test(issue.message);
    return NextResponse.json(
      { message: propria ? issue.message : "Revise os dados do pedido e tente novamente." },
      { status: 400 },
    );
  }
  if (parsed.data.paymentMethod === "cash_on_delivery" && !isUberlandia(parsed.data.customer.city)) {
    return NextResponse.json({ message: "Pagar no ato da entrega está disponível somente para Uberlândia." }, { status: 400 });
  }
  if (parsed.data.deliveryMethod === "uberlandia_delivery" && !isUberlandia(parsed.data.customer.city)) {
    return NextResponse.json({ message: "A entrega local está disponível somente para Uberlândia." }, { status: 400 });
  }

  try {
    // Leitura fresca so para validar (produto, preco, estoque); a gravacao e
    // uma transacao no banco, sem reescrever o catalogo inteiro.
    const state = await readCatalogState(true);
    const created = await createPendingSalesOrder(state, parsed.data);

    // O atendimento do pedido (e, no rodizio, o atendente do pedido) e gravado
    // DEPOIS da resposta: o cliente nao espera o CRM para ver "Solicitacao
    // recebida", e nenhuma falha ali pode transformar o 201 num erro —
    // `registerSiteOrderLead` so avisa no console. O cookie e lido agora,
    // enquanto a requisicao ainda esta em maos.
    const attribution = attributionFromCookie(request.cookies.get(ORIGIN_COOKIE)?.value);
    after(() => registerSiteOrderLead(state, created, attribution));

    return NextResponse.json({ ok: true, orderId: created.id, orderNumber: created.number }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderOperationError) return NextResponse.json({ message: error.message }, { status: 409 });
    return NextResponse.json({ message: "Nao foi possivel registrar o pedido agora. Tente novamente em instantes." }, { status: 500 });
  }
}

function isUberlandia(city: string): boolean {
  return city.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === "uberlandia";
}

function sameOrigin(request: NextRequest): boolean {
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

function isRateLimited(request: NextRequest): boolean {
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
