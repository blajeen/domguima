import { NextResponse } from "next/server";
import { getSuggestions } from "@/lib/catalog/queries";

/**
 * Autocomplete do header. Existe como rota para que o catálogo inteiro fique
 * no servidor — o navegador só baixa as 6 sugestões que vai mostrar.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  return NextResponse.json(
    { suggestions: await getSuggestions(query) },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
