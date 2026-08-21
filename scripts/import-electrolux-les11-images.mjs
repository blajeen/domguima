import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const productDir = join(
  process.cwd(),
  "public",
  "produtos",
  "maquina-de-lavar-electrolux-11kg-les11-49",
);

// Loja oficial Electrolux, SKU 2004292 (LES11 127V), consultada em 20/08/2026.
// A foto frontal vem primeiro para ser a capa principal da galeria.
const officialImages = [
  "https://electrolux.vtexassets.com/arquivos/ids/267290/Lavadora_Les11_Electrolux_Frente.png?v=638729971359130000",
  "https://electrolux.vtexassets.com/arquivos/ids/267289/lavadora-de-roupas-electrolux-essencial-care-11kg-Detalhe2.jpg?v=638729971359000000",
  "https://electrolux.vtexassets.com/arquivos/ids/267291/Washer_LES11_Specs_Electrolux_1000x1000.jpg?v=638729971359300000",
  "https://electrolux.vtexassets.com/arquivos/ids/267292/Lavadora_Les11_Electrolux_detalhe1.png?v=638729971359470000",
  "https://electrolux.vtexassets.com/arquivos/ids/267293/A17236507revB_G0025641rev003_ENCE-LES11-127V_page-0001.jpg?v=638729971359630000",
];

await mkdir(productDir, { recursive: true });

for (const [index, url] of officialImages.entries()) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Electrolux respondeu ${response.status} para ${url}`);
  }

  const source = Buffer.from(await response.arrayBuffer());
  const target = join(productDir, `${index + 1}.jpg`);

  await sharp(source)
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(target);

  console.log(`${index + 1}.jpg <- ${url}`);
}
