#!/usr/bin/env node
/**
 * OTIMIZADOR DE ARTES
 * ===================
 *
 *   npm run optimize:assets
 *
 * Lê os masters em `design/` e gera os arquivos que o site realmente serve:
 *
 *   design/social-dom-guima-1200x630.png → public/brand/social-dom-guima.jpg
 *   design/favicon-dom-guima-512.png     → src/app/icon.png (128px)
 *                                        → src/app/apple-icon.png (180px)
 *
 * Por que isso existe: a prévia de link (Open Graph) e os ícones são servidos
 * crus, sem passar pelo `next/image`. Um PNG de 1,4 MB na prévia faz o WhatsApp
 * desistir de renderizar — e a prévia do link é onde a loja mais vende.
 *
 * Rode sempre que trocar alguma arte em `design/`.
 *
 * Usa o navegador (via Playwright) como conversor, para o projeto não precisar
 * carregar uma dependência de processamento de imagem em produção.
 */

import { chromium } from "playwright";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const JOBS = [
  {
    from: "design/social-dom-guima-1200x630.png",
    to: "public/brand/social-dom-guima.jpg",
    width: 1200,
    height: 630,
    mime: "image/jpeg",
    quality: 0.86,
    /** Acima disso o WhatsApp costuma ignorar a prévia. */
    maxKB: 300,
  },
  {
    from: "design/favicon-dom-guima-512.png",
    to: "src/app/icon.png",
    width: 128,
    height: 128,
    mime: "image/png",
    maxKB: 40,
  },
  {
    from: "design/favicon-dom-guima-512.png",
    to: "src/app/apple-icon.png",
    width: 180,
    height: 180,
    mime: "image/png",
    maxKB: 60,
  },
];

/** Fundo usado ao achatar transparência em JPEG — o grafite da marca. */
const FLATTEN_BG = "#101216";

const missing = JOBS.filter((j) => !existsSync(join(ROOT, j.from)));
if (missing.length > 0) {
  console.error("✗ Master(s) não encontrado(s):");
  for (const j of new Set(missing.map((m) => m.from))) console.error(`   ${j}`);
  console.error("\n  Veja design/README.md.\n");
  process.exit(1);
}

const browser = await chromium.launch({ channel: process.env.SMOKE_BROWSER ?? "msedge" });
const page = await browser.newPage();

let warnings = 0;
console.log("Gerando derivados:\n");

for (const job of JOBS) {
  const srcPath = join(ROOT, job.from);
  const outPath = join(ROOT, job.to);
  const b64 = readFileSync(srcPath).toString("base64");

  const dataUrl = await page.evaluate(
    async ({ src, w, h, mime, quality, bg }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      // JPEG não tem alfa: sem isso, o transparente vira preto puro.
      if (mime === "image/jpeg") {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL(mime, quality);
    },
    {
      src: `data:image/png;base64,${b64}`,
      w: job.width,
      h: job.height,
      mime: job.mime,
      quality: job.quality,
      bg: FLATTEN_BG,
    },
  );

  const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
  writeFileSync(outPath, buffer);

  const beforeKB = statSync(srcPath).size / 1024;
  const afterKB = buffer.length / 1024;
  const over = job.maxKB && afterKB > job.maxKB;
  if (over) warnings++;

  console.log(
    `  ${over ? "!" : "✓"} ${job.to.padEnd(34)} ${job.width}x${job.height}  ` +
      `${beforeKB.toFixed(0)} KB → ${afterKB.toFixed(0)} KB`,
  );
  if (over) {
    console.log(`      acima do limite de ${job.maxKB} KB — simplifique a arte`);
  }
}

await browser.close();

/**
 * Gera src/app/favicon.ico embrulhando o PNG de 128px no contêiner ICO.
 *
 * Existe para o caminho fixo /favicon.ico não responder 404: navegadores
 * modernos usam a tag <link>, mas crawlers, leitores de feed e atalhos salvos
 * ainda pedem esse endereço direto.
 *
 * ICO aceita um PNG inteiro dentro dele desde o Windows Vista, então basta o
 * cabeçalho de 22 bytes — sem precisar converter para bitmap.
 */
function writeIco(pngPath, icoPath) {
  const png = readFileSync(pngPath);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // 1 = ícone
  header.writeUInt16LE(1, 4); // uma imagem

  const entry = Buffer.alloc(16);
  entry.writeUInt8(width >= 256 ? 0 : width, 0); // 0 significa 256
  entry.writeUInt8(height >= 256 ? 0 : height, 1);
  entry.writeUInt8(0, 2); // paleta
  entry.writeUInt8(0, 3); // reservado
  entry.writeUInt16LE(1, 4); // planos de cor
  entry.writeUInt16LE(32, 6); // bits por pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  const ico = Buffer.concat([header, entry, png]);
  writeFileSync(icoPath, ico);
  return { size: ico.length, width, height };
}

const ico = writeIco(join(ROOT, "src/app/icon.png"), join(ROOT, "src/app/favicon.ico"));
console.log(
  `  ✓ ${"src/app/favicon.ico".padEnd(34)} ${ico.width}x${ico.height}  ` +
    `${(ico.size / 1024).toFixed(0)} KB`,
);

console.log(
  warnings === 0
    ? "\n✓ Tudo dentro dos limites.\n"
    : `\n! ${warnings} arquivo(s) acima do limite recomendado.\n`,
);
