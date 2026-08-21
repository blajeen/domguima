#!/usr/bin/env node

import { mkdir, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import sharp from "sharp";

const root = join(process.cwd(), "docs", "DOM GUIMA SHOP");
const output = join(process.cwd(), ".image-audit");
const supported = new Set([".png", ".jpg", ".jpeg", ".webp"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (supported.has(extname(entry.name).toLowerCase())) files.push(path);
  }
  return files;
}

const xml = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const files = (await walk(root)).sort((a, b) => a.localeCompare(b, "pt-BR"));
await mkdir(output, { recursive: true });

const columns = 4;
const rows = 3;
const cellWidth = 320;
const cellHeight = 360;
const perSheet = columns * rows;

for (let page = 0; page < Math.ceil(files.length / perSheet); page++) {
  const pageFiles = files.slice(page * perSheet, (page + 1) * perSheet);
  const layers = [];

  for (const [index, file] of pageFiles.entries()) {
    const x = (index % columns) * cellWidth;
    const y = Math.floor(index / columns) * cellHeight;
    const label = relative(root, file).replaceAll("\\", " / ");
    const image = await sharp(file)
      .rotate()
      .resize(288, 288, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82 })
      .toBuffer();
    const caption = Buffer.from(`
      <svg width="304" height="48" xmlns="http://www.w3.org/2000/svg">
        <rect width="304" height="48" fill="#ffffff"/>
        <text x="8" y="19" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#17233f">
          ${xml(label.slice(0, 43))}
        </text>
        <text x="8" y="36" font-family="Arial, sans-serif" font-size="11" fill="#59647a">
          ${xml(label.slice(43, 88))}
        </text>
      </svg>
    `);

    layers.push({ input: image, left: x + 16, top: y + 12 });
    layers.push({ input: caption, left: x + 8, top: y + 304 });
  }

  await sharp({
    create: {
      width: columns * cellWidth,
      height: rows * cellHeight,
      channels: 3,
      background: "#eef1f6",
    },
  })
    .composite(layers)
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(join(output, `owner-catalog-${String(page + 1).padStart(2, "0")}.jpg`));
}

console.log(`Auditoria do catalogo do dono: ${files.length} imagens.`);
