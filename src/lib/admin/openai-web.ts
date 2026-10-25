import "server-only";

/**
 * Uma pergunta com pesquisa na web e resposta em JSON (schema estrito).
 * A chave fica no servidor. Usada pela busca de fotos oficiais e pelo
 * comparativo de preco; a pesquisa de cadastro tem a sua propria chamada.
 */
export class OpenAIWebError extends Error {}

export function hasOpenAIConfig(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function askWithWebSearch(options: { instructions: string; input: unknown; schemaName: string; schema: Record<string, unknown>; timeoutMs: number; maxToolCalls?: number }): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new OpenAIWebError("A pesquisa na web não está configurada (OPENAI_API_KEY na Vercel).");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_PRODUCT_RESEARCH_MODEL?.trim() || "gpt-5.4-mini",
        store: false,
        max_output_tokens: 2_500,
        max_tool_calls: options.maxToolCalls ?? 5,
        reasoning: { effort: "none" },
        tools: [{ type: "web_search_preview", search_context_size: "low", user_location: { type: "approximate", country: "BR", timezone: "America/Sao_Paulo" } }],
        tool_choice: "required",
        input: [
          { role: "developer", content: [{ type: "input_text", text: options.instructions }] },
          { role: "user", content: [{ type: "input_text", text: JSON.stringify(options.input) }] },
        ],
        text: { format: { type: "json_schema", name: options.schemaName, strict: true, schema: options.schema } },
      }),
    });
    if (!response.ok) throw new OpenAIWebError(response.status === 401 || response.status === 403 ? "A chave da pesquisa na web foi recusada." : "A pesquisa na web está indisponível agora.");
    const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const text = payload.output_text || payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text || "";
    try { return JSON.parse(text); } catch { throw new OpenAIWebError("A pesquisa voltou num formato inesperado. Tente de novo."); }
  } catch (error) {
    if (error instanceof OpenAIWebError) throw error;
    throw new OpenAIWebError(error instanceof Error && error.name === "AbortError" ? "A pesquisa demorou demais. Tente de novo." : "Não foi possível pesquisar agora.");
  } finally {
    clearTimeout(timer);
  }
}
