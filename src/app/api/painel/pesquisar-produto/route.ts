import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwner } from "@/lib/admin/auth";
import { ProductResearchError, researchProduct } from "@/lib/admin/product-research";

const requestSchema = z.object({
  name: z.string().trim().max(180),
  brand: z.string().trim().max(100),
  model: z.string().trim().min(2).max(100),
  gtin: z.string().trim().max(14),
  category: z.string().trim().max(100),
});

export const maxDuration = 45;
const requestLog = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1_000;
const MAX_REQUESTS = 20;

export async function POST(request: Request) {
  const owner = await getOwner();
  if (!owner) return NextResponse.json({ message: "Acesso não autorizado." }, { status: 401 });
  if (isRateLimited(owner.id)) return NextResponse.json({ message: "Muitas pesquisas em pouco tempo. Aguarde alguns minutos e tente novamente." }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Não conseguimos ler os dados da pesquisa." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Informe um modelo válido para pesquisar." }, { status: 400 });

  try {
    const result = await researchProduct(parsed.data);
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    if (error instanceof ProductResearchError) {
      const status = error.code === "not_configured" ? 503 : 502;
      return NextResponse.json({ message: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ message: "Não foi possível pesquisar este modelo agora." }, { status: 502 });
  }
}

function isRateLimited(ownerId: string): boolean {
  const now = Date.now();
  const current = requestLog.get(ownerId);
  if (!current || current.resetAt <= now) {
    requestLog.set(ownerId, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS;
}
