#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const catalogRoot = join(process.cwd(), "docs", "DOM GUIMA SHOP");
const productRoot = join(process.cwd(), "public", "produtos");

/**
 * Fotos enviadas pelo dono da Dom Guima. Somente correspondencias inequívocas
 * entram aqui; capacidade, modelo e tamanho precisam coincidir com o produto.
 */
const OWNER_CATALOG = new Map([
  ["chapa-taiff-style-azul-65", ["BELEZA/CHAPA TAIFF.png"]],
  ["secador-britania-bsc2050-66", ["BELEZA/SECADOR BSC2050.png"]],
  ["secador-de-cabelo-britania-sp3100n-67", ["BELEZA/VENTILADOR BRITANIA.png"]],

  ["ar-condicionado-philco-inverter-9000-btus-frio-pac9ft-7", ["CLIMATIZACAO/01 - PAC9FT.png"]],
  ["ar-condicionado-consul-triple-inverter-9-000-btus-cbk09db-frio-8", ["CLIMATIZACAO/02 - CBK09DB.jpg"]],
  ["ar-condicionado-philco-inverter-12000-btus-frio-pac12fc-9", ["CLIMATIZACAO/03 - PAC12FC.png"]],
  ["ar-condicionado-elgin-inverter-12-000-btus-hife12c2ca-frio-10", ["CLIMATIZACAO/04 - ELGIN.jpg"]],
  ["ar-condicionado-philco-inverter-12-000-btus-pac12qc-quente-frio-11", ["CLIMATIZACAO/05 - PAC12QC.jpg"]],
  ["ar-condicionado-samsung-inverter-12-000-btus-ar12dyfaawkxaz-frio-12", ["CLIMATIZACAO/06 - AR12DYFAAWKXAZ.jpg"]],
  ["climatizador-de-ar-britania-bcl05a-13", ["CLIMATIZACAO/07 - BCL05A.png"]],
  ["climatizador-de-ar-philco-pcl05a-14", ["CLIMATIZACAO/08 - PCL05A.jpg"]],
  ["aquecedor-britania-ab1100n-15", ["CLIMATIZACAO/09 - AB1100N.png"]],
  ["ventilador-de-mesa-elgin-breeze-air-16", ["CLIMATIZACAO/10 - ELGIN.png"]],
  ["ventilador-de-mesa-britania-super-turbo-bvt405-17", ["CLIMATIZACAO/11 - BVT405.png"]],
  ["ventilador-de-mesa-mondial-super-power-vsp-40-b-18", ["CLIMATIZACAO/12 - VSP-40-B.png"]],
  ["ventilador-de-mesa-mondial-super-turbo-vtx-40-8p-19", ["CLIMATIZACAO/13 - VTX-40-8P.png"]],
  ["ventilador-de-mesa-philco-pvt402-20", ["CLIMATIZACAO/14 - PVT402.png"]],
  ["ventilador-de-mesa-wap-flow-turbo-21", ["CLIMATIZACAO/15 - WAP FLOW.png"]],
  ["ventilador-de-coluna-mondial-super-turbo-vtx-40c-8p-22", ["CLIMATIZACAO/16- VTX-40C-8P.png"]],
  ["ventilador-de-parede-ventisol-premium-50cm-23", ["CLIMATIZACAO/17 - VENTISOL50CM.png"]],
  ["ventilador-de-parede-ventisol-premium-60cm-24", ["CLIMATIZACAO/18 - VENTISOL60CM.png"]],

  ["lava-loucas-midea-8-servicos-mdwtf08w1-51", ["ELETRODOMESTICOS/LAVA LOUÇA MIDEA.png"]],
  ["maquina-de-lavar-electrolux-lee15-14-5kg-50", ["ELETRODOMESTICOS/MAQUINA DE LAVAR LEE15.png"]],
  ["maquina-de-lavar-electrolux-11kg-les11-49", ["ELETRODOMESTICOS/MAQUINA LES11.png"]],
  ["micro-ondas-electrolux-mto30-45", ["ELETRODOMESTICOS/MICROONDAS ELECTROLUX 20L.png"]],

  ["copo-stanley-beer-tumbler-happy-hour-384ml-35", [
    "GERAL/BEER TUMBLER BRANCO.png",
    "GERAL/BEER TUMBLER PRETO.png",
    "GERAL/BEER TUMBLER METALICO.png",
  ]],
  ["copo-stanley-pilsner-glass-happy-hour-444ml-36", [
    "GERAL/PILSNER GLASS BRANCO.png",
    "GERAL/PILSNER GLASS PRETO.png",
    "GERAL/PILSNER GLASS METALICO.png",
  ]],
  ["taca-termica-cocktail-glass-stanley-414ml-37", ["GERAL/TAÇA PRETA.png", "GERAL/TAÇA METALICA.png"]],
  ["esmerilhadeira-bosch-gws-700-25", ["GERAL/esmerilhadeira1.png"]],
  ["fechadura-digital-elsys-pop-ds1100v-27", ["GERAL/FECHADURA ELSYS.jpeg"]],
  ["fechadura-digital-intelbras-fr221v-26", ["GERAL/FECHADURA INTELBRAS.jpeg"]],
  ["parafusadeira-titanium-12v-7743-28", ["GERAL/TITANIUM.png"]],
  ["parafusadeira-vonder-12v-pfv012i-29", ["GERAL/VONDER1.png"]],

  ["cadeira-gamer-xt-racer-speed-series-68", ["INFORMATICA/CADEIRA GAMER1.png"]],
  ["fone-gamer-dazz-immersion-76", ["INFORMATICA/FONE DAZZ.png"]],
  ["fone-gamer-oex-shield-hs409-77", ["INFORMATICA/FONE OEX GAME.jpg"]],
  ["kit-gamer-dazz-arsenal-75", ["INFORMATICA/kit gamer dazz.png"]],
  ["mochila-targus-intellect-essentials-tsb966-15-6-74", ["INFORMATICA/MOCHILA TARGUS.png"]],
  ["monitor-samsung-odyssey-g40-25-70", ["INFORMATICA/MONITOR G40.png"]],
  ["mouse-gamer-asus-tuf-gaming-m3-71", ["INFORMATICA/MOUSE ASUS TUF.png"]],
  ["mouse-lenovo-thinkpad-morfn60-72", ["INFORMATICA/MOUSE LENOVO.png"]],

  ["air-fryer-britania-bfr50-redstone-5-5l-53", ["PORTATIL/AIR FRYER BRITANIA.png"]],
  ["batedeira-planetaria-mondial-premium-bp-01p-w-55", ["PORTATIL/BATEDEIRA MONDIAL.png"]],
  ["sanduicheira-cadence-toast-grill-san260-63", ["PORTATIL/CADENSE.png"]],
  ["liquidificador-britania-diamante-800-58", ["PORTATIL/DIAMANTE 800.png"]],
  ["ferro-a-vapor-arno-essentialgliss-fmq-62", ["PORTATIL/Ferro Arno Essentialgliss.png"]],
  ["ferro-electrolux-a-vapor-e-a-seco-sie60-azul-61", ["PORTATIL/FERRO ELECTROLUX.png"]],
  ["ferro-a-vapor-mondial-fvn-01-o-60", ["PORTATIL/FERRO MONDIAL.png"]],
  ["lavadora-de-alta-pressao-karcher-compacta-54", ["PORTATIL/KARCHER.png"]],
  ["air-fryer-kitchen-art-kfr01-5-7l-52", ["PORTATIL/KITCHEN ART.png"]],
  ["liquidificador-britania-blq1100-59", ["PORTATIL/LIQUIDIFICADOR BLQ1100.jpeg"]],
  ["mixer-processador-philips-walita-pro-mix-ri2530-56", ["PORTATIL/MIXER WALITA.png"]],
  ["sanduicheira-e-grill-philco-pgr21pi-maxx-clean-64", ["PORTATIL/SANDUICHEIRA PHILCO.png"]],

  ["smart-tv-toshiba-32-hd-32v35l-tb016m-79", ["SMART TV/01.png"]],
  ["smart-tv-samsung-32-h5000f-80", ["SMART TV/02.png"]],
  ["smart-tv-lg-uhd-ai-4k-50-50ua8550psa-83", ["SMART TV/LG 4k.png"]],
  ["smart-tv-samsung-50-crystal-uhd-u8100f-84", ["SMART TV/SAMSUNG 50.png"]],
  ["smart-tv-samsung-55-crystal-uhd-4k-u8600f-85", ["SMART TV/SAMSUNG 55.png"]],
  ["smart-tv-samsung-75-crystal-uhd-4k-u8600f-86", ["SMART TV/SAMSUNG 75.jpeg"]],
  ["soundbar-samsung-hw-b450f-78", ["SMART TV/SOUNDBAR.png"]],
]);

let imageCount = 0;

for (const [slug, relativeSources] of OWNER_CATALOG) {
  const destinationDir = join(productRoot, slug);
  await mkdir(destinationDir, { recursive: true });

  for (const [index, relativeSource] of relativeSources.entries()) {
    const source = join(catalogRoot, ...relativeSource.split("/"));
    const destination = join(destinationDir, `owner-${index + 1}.webp`);

    await sharp(source)
      .rotate()
      .toColourspace("srgb")
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 91, alphaQuality: 95, effort: 5, smartSubsample: true })
      .toFile(destination);

    imageCount++;
  }
}

console.log(
  `Catalogo do dono importado: ${imageCount} imagens para ${OWNER_CATALOG.size} produtos.`,
);
