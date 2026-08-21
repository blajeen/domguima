#!/usr/bin/env node

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = join(dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1")), "..");
const PRODUCT_ROOT = join(ROOT, "public", "produtos");
const OUTPUT_ROOT = join(ROOT, ".image-audit");
const COLS = 4;
const ROWS = 4;
const TILE_WIDTH = 300;
const TILE_HEIGHT = 310;
const IMAGE_SIZE = 236;

const escapeXml = (value) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);

async function alphaPercentage(file) {
  const metadata = await sharp(file).metadata();
  if (!metadata.hasAlpha) return 0;
  const stats = await sharp(file).extractChannel("alpha").stats();
  return Math.max(0, Math.min(100, (1 - stats.channels[0].mean / 255) * 100));
}

async function main() {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const directories = (await readdir(PRODUCT_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && existsSync(join(PRODUCT_ROOT, entry.name, "cover.webp")))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const report = [];
  const perSheet = COLS * ROWS;
  for (let page = 0; page < Math.ceil(directories.length / perSheet); page++) {
    const entries = directories.slice(page * perSheet, (page + 1) * perSheet);
    const composites = [];
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      const file = join(PRODUCT_ROOT, entry.name, "cover.webp");
      const alpha = await alphaPercentage(file);
      report.push({ slug: entry.name, alphaPercentage: Number(alpha.toFixed(1)) });
      const product = await sharp(file)
        .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();
      const label = Buffer.from(`<svg width="${TILE_WIDTH}" height="64" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:Arial,sans-serif;fill:#17213a}.name{font-size:12px;font-weight:700}.meta{font-size:11px;fill:#667085}</style><text class="name" x="12" y="20">${escapeXml(entry.name.slice(0, 39))}</text><text class="meta" x="12" y="42">transparencia ${alpha.toFixed(1)}%</text></svg>`);
      const x = (index % COLS) * TILE_WIDTH;
      const y = Math.floor(index / COLS) * TILE_HEIGHT;
      composites.push({ input: product, left: x + 32, top: y + 10 });
      composites.push({ input: label, left: x, top: y + 246 });
    }
    await sharp({
      create: { width: COLS * TILE_WIDTH, height: ROWS * TILE_HEIGHT, channels: 3, background: "#ece7df" },
    })
      .composite(composites)
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(join(OUTPUT_ROOT, `review-${String(page + 1).padStart(2, "0")}.jpg`));
  }

  await writeFile(join(OUTPUT_ROOT, "cover-alpha-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Auditoria criada: ${report.length} capas em ${Math.ceil(report.length / perSheet)} pranchas.`);
}

main().catch((error) => {
  console.error("Falha ao auditar capas:", error);
  process.exitCode = 1;
});
