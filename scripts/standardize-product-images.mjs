#!/usr/bin/env node

import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = join(dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1")), "..");
const PRODUCT_ROOT = join(ROOT, "public", "produtos");
const AI_ROOT = join(ROOT, "design", "product-cutouts-raw");
const COVER_SIZE = 1200;
const CONTENT_SIZE = 960;

/**
 * Capas extraidas com IA a partir de artes promocionais ou ambientes reais.
 * O original continua como imagem da galeria; somente a capa usa o recorte.
 */
const AI_OVERRIDES = new Map([
  ["purificador-electrolux-efficient-pe11x-42", "purificador.png"],
  ["sanduicheira-cadence-toast-grill-san260-63", "sanduicheira.png"],
  ["lixeira-tramontina-inox-5l-34", "lixeira.png"],
  ["batedeira-planetaria-mondial-premium-bp-01p-w-55", "batedeira.png"],
  ["maquina-de-lavar-electrolux-11kg-les11-49", "lavadora.png"],
  ["climatizador-de-ar-philco-pcl05a-14", "climatizador-philco.png"],
  ["suporte-duplo-para-controle-ps5-0", "suporte-ps5.png"],
]);

const CHROMA_KEY_OVERRIDES = new Set([
  "maquina-de-lavar-electrolux-11kg-les11-49",
  "climatizador-de-ar-philco-pcl05a-14",
]);

// Regioes brancas fechadas que representam fundo, mas nao alcancam a borda.
// Coordenadas normalizadas mantem o ajuste estavel mesmo se a fonte mudar de tamanho.
const INTERNAL_WHITE_BACKGROUND_SEEDS = new Map([
  ["ferro-vapor-arno-essentialgliss", [[0.5, 0.4]]],
]);

/** Remove o quadriculado incorporado pela ferramenta de edicao.
 *
 * So pixels cinza muito claros conectados as bordas sao removidos. Dessa
 * forma, partes brancas internas do produto ficam protegidas pelo contorno.
 */
async function removeBakedCheckerboard(input) {
  const { data, info } = await sharp(input).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const isBackground = (pixel) => {
    const offset = pixel * channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    return Math.min(r, g, b) >= 224 && Math.max(r, g, b) - Math.min(r, g, b) <= 10;
  };

  const enqueue = (pixel) => {
    if (visited[pixel] || !isBackground(pixel)) return;
    visited[pixel] = 1;
    queue[tail++] = pixel;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }

  for (let pixel = 0; pixel < visited.length; pixel++) {
    if (visited[pixel]) data[pixel * channels + 3] = 0;
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

/** Remove o fundo verde tecnico usado para proteger produtos brancos. */
async function removeConnectedChromaGreen(input) {
  const { data, info } = await sharp(input).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const isBackground = (pixel) => {
    const offset = pixel * channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    return g >= 120 && g - r >= 48 && g - b >= 48;
  };
  const enqueue = (pixel) => {
    if (visited[pixel] || !isBackground(pixel)) return;
    visited[pixel] = 1;
    queue[tail++] = pixel;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }

  for (let pixel = 0; pixel < visited.length; pixel++) {
    const offset = pixel * channels;
    if (visited[pixel]) {
      data[offset + 3] = 0;
      continue;
    }

    // Neutraliza o pequeno reflexo verde de antialiasing na borda sem alterar
    // os tons brancos, cinza, azul e roxo dos dois eletrodomesticos.
    const neutral = Math.max(data[offset], data[offset + 2]);
    if (data[offset + 1] > neutral + 5) data[offset + 1] = neutral;
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * Recorta fundos brancos simples sem apagar partes claras internas do produto.
 * Apenas pixels claros conectados as bordas sao removidos; fotos de ambiente e
 * artes promocionais continuam intactas para revisao manual.
 */
async function removeConnectedWhiteBackground(input, internalSeeds = []) {
  const { data, info } = await sharp(input).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const isBackground = (pixel) => {
    const offset = pixel * channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    return Math.min(r, g, b) >= 238 && Math.max(r, g, b) - Math.min(r, g, b) <= 18;
  };
  const enqueue = (pixel) => {
    if (visited[pixel] || !isBackground(pixel)) return;
    visited[pixel] = 1;
    queue[tail++] = pixel;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  for (const [normalizedX, normalizedY] of internalSeeds) {
    const x = Math.max(0, Math.min(width - 1, Math.round(normalizedX * (width - 1))));
    const y = Math.max(0, Math.min(height - 1, Math.round(normalizedY * (height - 1))));
    enqueue(y * width + x);
  }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }

  for (let pixel = 0; pixel < visited.length; pixel++) {
    if (visited[pixel]) data[pixel * channels + 3] = 0;
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

async function whiteEdgePercentage(input) {
  const { data, info } = await sharp(input).rotate().resize(32, 32, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let white = 0;
  let total = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (x !== 0 && y !== 0 && x !== info.width - 1 && y !== info.height - 1) continue;
      const offset = (y * info.width + x) * info.channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      if (r > 236 && g > 236 && b > 236) white++;
      total++;
    }
  }
  return total ? (white / total) * 100 : 0;
}

async function makeCover(source, destination, extracted, slug, ownerCatalog = false) {
  if (ownerCatalog) {
    // As fotos enviadas pelo dono ja possuem direcao de arte consistente. Elas
    // ocupam toda a capa para evitar uma segunda moldura dentro dos cards.
    await sharp(source)
      .rotate()
      .toColourspace("srgb")
      .resize(COVER_SIZE, COVER_SIZE, { fit: "cover", position: "centre" })
      .sharpen({ sigma: 0.35, m1: 0.3, m2: 0.6 })
      .webp({ quality: 90, effort: 5, smartSubsample: true })
      .toFile(destination);
    return { autoExtracted: false };
  }

  let input = extracted
    ? CHROMA_KEY_OVERRIDES.has(slug)
      ? await removeConnectedChromaGreen(source)
      : await removeBakedCheckerboard(source)
    : source;
  const edgeWhite = extracted ? 0 : await whiteEdgePercentage(source);
  const autoExtracted = !extracted && edgeWhite >= 10;
  if (!extracted) input = await removeConnectedWhiteBackground(source, INTERNAL_WHITE_BACKGROUND_SEEDS.get(slug));
  // Toda capa usa canvas transparente. Fotos de ambiente continuam retangulares,
  // mas nao recebem um segundo fundo branco artificial ao serem enquadradas.
  const transparent = true;
  let pipeline = sharp(input).rotate().toColourspace("srgb");

  // Elimina o excesso de margem antes de aplicar o enquadramento comum.
  // Artes promocionais e fotos de ambiente sem borda branca nao sao cortadas.
  if (extracted || edgeWhite >= 10) {
    pipeline = pipeline.trim({ threshold: 6 });
  }

  await pipeline
    .resize(CONTENT_SIZE, CONTENT_SIZE, {
      fit: "contain",
      withoutEnlargement: false,
      background: transparent
        ? { r: 255, g: 255, b: 255, alpha: 0 }
        : { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .extend({
      top: (COVER_SIZE - CONTENT_SIZE) / 2,
      bottom: (COVER_SIZE - CONTENT_SIZE) / 2,
      left: (COVER_SIZE - CONTENT_SIZE) / 2,
      right: (COVER_SIZE - CONTENT_SIZE) / 2,
      background: transparent
        ? { r: 255, g: 255, b: 255, alpha: 0 }
        : { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .sharpen({ sigma: 0.45, m1: 0.35, m2: 0.7 })
    .webp({ quality: 88, alphaQuality: 95, effort: 5, smartSubsample: true })
    .toFile(destination);

  return { autoExtracted };
}

async function main() {
  const requestedSlug = process.argv[2]?.trim();
  const directories = readdirSync(PRODUCT_ROOT, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && (!requestedSlug || entry.name === requestedSlug),
  );
  if (requestedSlug && directories.length === 0) throw new Error(`Produto nao encontrado: ${requestedSlug}`);
  let generated = 0;
  let extracted = 0;
  let autoExtracted = 0;
  let skipped = 0;

  for (const directory of directories) {
    const dir = join(PRODUCT_ROOT, directory.name);
    const original = join(dir, "1.jpg");
    const ownerSource = join(dir, "owner-1.webp");
    const usesOwnerCatalog = existsSync(ownerSource);
    const overrideName = AI_OVERRIDES.get(directory.name);
    const override = overrideName ? join(AI_ROOT, overrideName) : null;
    const usesExtraction = Boolean(override && existsSync(override));

    if (!usesOwnerCatalog && !usesExtraction && !existsSync(original)) {
      skipped++;
      continue;
    }

    const source = usesOwnerCatalog ? ownerSource : usesExtraction ? override : original;
    const destination = join(dir, "cover.webp");
    const result = await makeCover(
      source,
      destination,
      !usesOwnerCatalog && usesExtraction,
      directory.name,
      usesOwnerCatalog,
    );
    generated++;
    if (!usesOwnerCatalog && usesExtraction) extracted++;
    if (result.autoExtracted) autoExtracted++;
    process.stdout.write(`\rCapas: ${generated}/${directories.length}`);
  }

  process.stdout.write("\n");
  console.log(`Concluido: ${generated} capas (${extracted} recortes revisados + ${autoExtracted} fundos brancos removidos), ${skipped} pastas sem foto.`);
}

main().catch((error) => {
  console.error("Falha ao padronizar imagens:", error);
  process.exitCode = 1;
});
