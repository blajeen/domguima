import "server-only";

import { ImageResponse } from "next/og";
import sharp from "sharp";
import { z } from "zod";
import { askWithWebSearch } from "./openai-web";
import { fetchPublic } from "./remote-fetch";

/**
 * Fotos oficiais e as duas artes do produto (capa e explicativa).
 *
 * Regra do dono: o produto e a foto REAL, nunca redesenhado por IA. Aqui so
 * se recorta a borda lisa, redimensiona, centraliza e poe fundo; nada de
 * gerar ou "melhorar" o aparelho. Foto pequena pode ser ampliada para caber
 * no quadro, e a tela avisa que isso nao ganha detalhe.
 */

export interface OfficialPhoto {
  url: string;
  pageUrl: string;
  domain: string;
  width: number;
  height: number;
  /** A pagina e do fabricante (dominio oficial), segundo a pesquisa. */
  manufacturer: boolean;
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MIN_SIDE = 500;
const isImage = (type: string) => type === "image/jpeg" || type === "image/png" || type === "image/webp";

const pagesSchema = z.object({ pages: z.array(z.object({ url: z.string(), manufacturer: z.boolean() })).max(6) });

/**
 * A pesquisa so aponta as PAGINAS do produto; as fotos saem do HTML dessas
 * paginas (JSON-LD de produto e og:image), baixadas e medidas aqui. Uma URL
 * de imagem "lembrada" pelo modelo de linguagem nao entra.
 */
export async function findOfficialPhotos(input: { name: string; brand: string; model: string; gtin: string; sourceUrl: string | null }): Promise<OfficialPhoto[]> {
  const resposta = pagesSchema.parse(await askWithWebSearch({
    schemaName: "product_pages",
    timeoutMs: 25_000,
    maxToolCalls: 4,
    instructions: [
      "Encontre as páginas do produto EXATO informado (mesma marca, mesmo modelo, mesma variante), priorizando a página oficial do fabricante e, depois, varejistas grandes e autorizados do Brasil.",
      "Só inclua páginas que mostrem esse mesmo modelo; letras, números e sufixos precisam coincidir. Não inclua páginas de modelos parecidos, buscas, categorias ou comparadores.",
      "Retorne até 4 URLs completas e marque manufacturer=true só quando o domínio for do fabricante.",
    ].join(" "),
    input,
    schema: { type: "object", additionalProperties: false, required: ["pages"], properties: { pages: { type: "array", items: { type: "object", additionalProperties: false, required: ["url", "manufacturer"], properties: { url: { type: "string" }, manufacturer: { type: "boolean" } } } } } },
  }));

  const paginas = [...(input.sourceUrl ? [{ url: input.sourceUrl, manufacturer: false }] : []), ...resposta.pages]
    .filter((page, indice, todas) => /^https?:\/\//.test(page.url) && todas.findIndex((item) => item.url === page.url) === indice)
    .slice(0, 5);

  const candidatas = (await Promise.allSettled(paginas.map(async (pagina) => {
    const html = (await fetchPublic(pagina.url, { maxBytes: 3 * 1024 * 1024, timeoutMs: 10_000, accept: (type) => type === "text/html" || type === "application/xhtml+xml" })).buffer.toString("utf8");
    return imageUrlsFromHtml(html, pagina.url, input.model).map((url) => ({ url, pageUrl: pagina.url, manufacturer: pagina.manufacturer }));
  }))).flatMap((item) => item.status === "fulfilled" ? item.value : [])
    .filter((item, indice, todas) => todas.findIndex((outra) => outra.url === item.url) === indice)
    .slice(0, 16);

  const medidas = await Promise.allSettled(candidatas.map(async (candidata) => {
    const arquivo = await fetchPublic(candidata.url, { maxBytes: MAX_IMAGE_BYTES, timeoutMs: 8_000, accept: isImage });
    const meta = await sharp(arquivo.buffer, { failOn: "none" }).metadata();
    return { ...candidata, width: meta.width ?? 0, height: meta.height ?? 0, domain: new URL(candidata.pageUrl).hostname.replace(/^www\./, "") };
  }));
  return medidas.flatMap((item) => item.status === "fulfilled" && Math.min(item.value.width, item.value.height) >= MIN_SIDE ? [item.value] : [])
    .sort((a, b) => Number(b.manufacturer) - Number(a.manufacturer) || b.width * b.height - a.width * a.height)
    .slice(0, 8);
}

/** Fotos de produto declaradas na pagina: JSON-LD, og:image e <img> que citam o modelo. */
export function imageUrlsFromHtml(html: string, pageUrl: string, model: string): string[] {
  const achadas: string[] = [];
  for (const bloco of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { collectLdImages(JSON.parse(bloco[1]), achadas); } catch { /* JSON-LD quebrado: ignora o bloco */ }
  }
  for (const meta of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = meta[0];
    if (/(?:property|name)\s*=\s*["'](?:og:image(?::secure_url)?|twitter:image)["']/i.test(tag)) {
      const conteudo = tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
      if (conteudo) achadas.push(conteudo);
    }
  }
  const codigo = model.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (codigo.length >= 4) {
    for (const img of html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = img[0];
      if (!tag.replace(/[^a-z0-9]/gi, "").toLowerCase().includes(codigo)) continue;
      const srcset = tag.match(/(?:data-)?srcset\s*=\s*["']([^"']+)["']/i)?.[1];
      const maior = srcset?.split(",").map((item) => item.trim().split(/\s+/)[0]).at(-1);
      const src = maior || tag.match(/(?:data-src|src)\s*=\s*["']([^"']+)["']/i)?.[1];
      if (src) achadas.push(src);
    }
  }
  return achadas.flatMap((url) => {
    try {
      const absoluta = new URL(url.replace(/&amp;/g, "&"), pageUrl);
      return absoluta.protocol === "https:" || absoluta.protocol === "http:" ? [absoluta.toString()] : [];
    } catch { return []; }
  });
}

function collectLdImages(node: unknown, out: string[]) {
  if (Array.isArray(node)) { node.forEach((item) => collectLdImages(item, out)); return; }
  if (!node || typeof node !== "object") return;
  const objeto = node as Record<string, unknown>;
  const imagem = objeto.image;
  if (typeof imagem === "string") out.push(imagem);
  else if (Array.isArray(imagem)) imagem.forEach((item) => typeof item === "string" ? out.push(item) : collectLdImages({ image: (item as Record<string, unknown>)?.url }, out));
  else if (imagem && typeof imagem === "object" && typeof (imagem as Record<string, unknown>).url === "string") out.push((imagem as Record<string, string>).url);
  for (const valor of Object.values(objeto)) if (valor && typeof valor === "object") collectLdImages(valor, out);
}

export async function downloadPhoto(url: string): Promise<Buffer> {
  return (await fetchPublic(url, { maxBytes: MAX_IMAGE_BYTES, timeoutMs: 12_000, accept: isImage })).buffer;
}

interface PreparedProduct { png: Buffer; width: number; height: number; enlarged: boolean; accent: string }

/** Recorta a borda lisa e cabe o produto na caixa. Nao mexe no produto em si. */
async function prepareProduct(buffer: Buffer, box: { width: number; height: number }): Promise<PreparedProduct> {
  const base = () => sharp(buffer, { failOn: "none" }).rotate().flatten({ background: "#ffffff" });
  // trim falha quando a foto inteira e lisa; ai segue a foto como veio.
  const recortada = await base().trim({ background: "#ffffff", threshold: 12 }).png().toBuffer({ resolveWithObject: true })
    .catch(() => base().png().toBuffer({ resolveWithObject: true }));
  const escala = Math.min(box.width / recortada.info.width, box.height / recortada.info.height);
  const width = Math.max(1, Math.round(recortada.info.width * escala));
  const height = Math.max(1, Math.round(recortada.info.height * escala));
  const png = await sharp(recortada.data).resize(width, height, { kernel: "lanczos3" }).sharpen({ sigma: 0.5 }).png().toBuffer();
  return { png, width, height, enlarged: escala > 1.05, accent: await accentColor(recortada.data) };
}

/**
 * Cor de destaque tirada do proprio produto (a "cor da marca" que ele
 * carrega): media dos pixels com cor de verdade, sem o branco do fundo nem o
 * preto das sombras. Produto todo cinza ou branco cai no dourado da loja.
 */
async function accentColor(buffer: Buffer): Promise<string> {
  const { data } = await sharp(buffer).resize(48, 48, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 3) {
    const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]];
    const max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb);
    if (max < 40 || min > 225 || (max - min) / max < 0.3) continue;
    r += pr; g += pg; b += pb; n += 1;
  }
  if (n < 20) return "#b8862b";
  // Escurece ate o icone branco ter contraste sobre a cor.
  let [cr, cg, cb] = [r / n, g / n, b / n];
  while ((0.2126 * cr + 0.7152 * cg + 0.0722 * cb) / 255 > 0.45) { cr *= 0.9; cg *= 0.9; cb *= 0.9; }
  return `#${[cr, cg, cb].map((valor) => Math.round(valor).toString(16).padStart(2, "0")).join("")}`;
}

const toJpeg = (input: Buffer) => sharp(input).flatten({ background: "#ffffff" }).jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer();

/** Capa: so a foto real, centralizada, em branco; o degradê fica so nos cantos, fora da caixa da foto (ela vem com fundo branco). */
export async function composeCover(photo: Buffer, size: number): Promise<{ jpeg: Buffer; enlarged: boolean }> {
  const produto = await prepareProduct(photo, { width: Math.round(size * 0.82), height: Math.round(size * 0.82) });
  const fundo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><radialGradient id="g" cx="50%" cy="50%" r="71%"><stop offset="85%" stop-color="#ffffff"/><stop offset="100%" stop-color="#e9ebef"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  const composta = await sharp(fundo).composite([{ input: produto.png, left: Math.round((size - produto.width) / 2), top: Math.round((size - produto.height) / 2) }]).png().toBuffer();
  return { jpeg: await toJpeg(composta), enlarged: produto.enlarged };
}

/** Explicativa: outro angulo a esquerda, cinco beneficios com icone a direita, separados por degradê. */
export async function composeExplainer(photo: Buffer, benefits: string[], size: number): Promise<{ jpeg: Buffer; enlarged: boolean }> {
  const produto = await prepareProduct(photo, { width: Math.round(size * 0.42), height: Math.round(size * 0.78) });
  const cor = produto.accent;
  const s = (fracao: number) => Math.round(size * fracao);
  const imagem = new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", background: "#ffffff" }}>
        <div style={{ width: s(0.48), height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${produto.png.toString("base64")}`} width={produto.width} height={produto.height} alt="" />
        </div>
        <div style={{ width: s(0.06), height: size, display: "flex", background: `linear-gradient(90deg, #ffffff, ${cor}26)` }} />
        <div style={{ flex: 1, height: size, display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${s(0.05)}px 0 ${s(0.02)}px`, background: `linear-gradient(90deg, ${cor}26, ${cor}12)` }}>
          {benefits.map((beneficio) => (
            <div key={beneficio} style={{ display: "flex", alignItems: "center", margin: `${s(0.018)}px 0` }}>
              <div style={{ width: s(0.075), height: s(0.075), minWidth: s(0.075), borderRadius: s(0.0375), background: cor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={s(0.042)} height={s(0.042)} viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div style={{ display: "flex", marginLeft: s(0.025), fontSize: s(0.036), lineHeight: 1.2, color: "#1f2328" }}>{beneficio}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
  return { jpeg: await toJpeg(Buffer.from(await imagem.arrayBuffer())), enlarged: produto.enlarged };
}
