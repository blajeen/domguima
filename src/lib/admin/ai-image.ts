import "server-only";

import { OpenAIWebError } from "./openai-web";

/**
 * Foto do produto DESENHADA pela IA da OpenAI, para quando nao ha foto real.
 *
 * Escolha do lojista (25/10/2026): sem foto, a IA desenha pelo nome e pelas
 * caracteristicas. O aparelho pode nao sair identico ao real; a tela marca
 * essas fotos como "IA" e pede conferencia antes de publicar. O texto das
 * vantagens nao e pedido a IA (erra portugues): o site escreve por cima.
 */
export interface AiPhotoInput { name: string; brand: string; model: string; color: string; details: string[] }

/** `padrao`: o padrao visual da loja (Configuracoes), que vai na frente de tudo. */
export async function generateProductPhotos(input: AiPhotoInput, padrao: string): Promise<{ front: Buffer; angle: Buffer }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new OpenAIWebError("A geração de imagens não está configurada (OPENAI_API_KEY na Vercel).");
  const produto = [input.brand, input.name, input.model && !input.name.includes(input.model) ? input.model : ""].filter(Boolean).join(" ");
  const base = [
    padrao,
    `Produto: ${produto}.`,
    input.color ? `Cor: ${input.color}.` : "",
    input.details.length ? `Características que a foto deve respeitar: ${input.details.slice(0, 6).join("; ")}.` : "",
    "Mostre só o produto, sem acessórios que não fazem parte dele.",
  ].filter(Boolean).join(" ");
  const [front, angle] = await Promise.all([
    gerar(apiKey, `${base} Vista de frente.`),
    gerar(apiKey, `${base} Vista em 3/4 pela lateral, um ângulo diferente da vista de frente.`),
  ]);
  return { front, angle };
}

async function gerar(apiKey: string, prompt: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1",
        prompt,
        size: "1024x1024",
        // "medium" cabe no limite de 60 s da hospedagem com as duas em paralelo.
        quality: "medium",
        output_format: "jpeg",
        n: 1,
      }),
    });
    if (!response.ok) {
      const motivo = response.status === 401 || response.status === 403 ? "a chave foi recusada ou não tem acesso a imagens" : response.status === 400 ? "o pedido foi recusado pela política de conteúdo" : `erro ${response.status}`;
      throw new OpenAIWebError(`A IA não gerou a imagem (${motivo}).`);
    }
    const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
    const b64 = payload.data?.[0]?.b64_json;
    if (!b64) throw new OpenAIWebError("A IA não devolveu a imagem.");
    return Buffer.from(b64, "base64");
  } catch (error) {
    if (error instanceof OpenAIWebError) throw error;
    throw new OpenAIWebError(error instanceof Error && error.name === "AbortError" ? "A IA demorou demais para gerar a imagem. Tente de novo." : "Não foi possível gerar a imagem agora.");
  } finally {
    clearTimeout(timer);
  }
}
