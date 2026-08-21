#!/usr/bin/env node
/**
 * IMPORTADOR DO CATÁLOGO DA SHOPEE (via cookie salvo)
 * ====================================================
 *
 *   npm run import:shopee          importa o catálogo completo
 *   npm run check:shopee           só testa se o cookie ainda vale
 *
 * Se você não tem um cookie salvo, ou ele expirou, é mais fácil rodar
 * `npm run login:shopee` — abre um navegador, você loga normalmente, e o
 * import roda direto na sessão autenticada, sem precisar copiar nada do
 * DevTools. Veja scripts/shopee-login-import.mjs.
 *
 * Este script aqui existe para reimportar rápido, sem abrir navegador, desde
 * que o cookie salvo pela última importação ainda esteja valendo:
 *
 *   1. arquivo shopee-cookie.txt na raiz do projeto (ignorado pelo git)
 *   2. variável de ambiente SHOPEE_COOKIE
 *
 * SOBRE O BLOQUEIO DA SHOPEE
 * --------------------------
 * O endpoint de listagem (`/api/v4/search/search_items`) é protegido por
 * antibot e responde 403 para requisição anônima. Os endpoints de SEO
 * (`get_shop_detail` e `get_shop_seo`) são abertos e funcionam sempre.
 */

import { writeCatalog, COOKIE_FILE, DEFAULT_UA, SHOP_ID, SHOP_USERNAME } from "./shopee-lib.mjs";
import { existsSync, readFileSync } from "node:fs";

/**
 * O cookie pode vir de duas formas — o arquivo é o caminho recomendado, porque
 * não passa pelo terminal (nada de aspas, nada de histórico de comandos).
 */
function readCookie() {
  if (process.env.SHOPEE_COOKIE?.trim()) {
    console.log("→ Usando cookie da variável SHOPEE_COOKIE.\n");
    return process.env.SHOPEE_COOKIE.trim();
  }
  if (existsSync(COOKIE_FILE)) {
    const raw = readFileSync(COOKIE_FILE, "utf8").trim();
    if (raw) {
      // O DevTools às vezes copia com o prefixo "Cookie:" junto.
      const cookie = raw.replace(/^Cookie:\s*/i, "").replace(/\s*\n\s*/g, " ");
      console.log(`→ Usando cookie de shopee-cookie.txt (${cookie.length} caracteres).\n`);
      return cookie;
    }
  }
  return null;
}

const cookie = readCookie();

const headers = {
  "User-Agent": DEFAULT_UA,
  Referer: `https://shopee.com.br/${SHOP_USERNAME}`,
  "x-api-source": "pc",
  "x-shopee-language": "pt-BR",
  Accept: "application/json",
  ...(cookie ? { Cookie: cookie } : {}),
};

/**
 * Nunca lança: falha de rede vira `{ status: 0, networkError }`, para quem
 * estiver rodando com internet instável receber uma mensagem em vez de um
 * stack trace.
 */
async function getJson(url) {
  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  } catch (error) {
    const cause = error.cause?.code ?? error.name ?? "desconhecido";
    return { status: 0, data: null, networkError: cause };
  }

  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: null, raw: text.slice(0, 200) };
  }
}

/**
 * `npm run check:shopee` — testa em segundos se o cookie ainda vale, sem
 * baixar nada nem tocar no catálogo. Serve para responder "preciso copiar o
 * cookie de novo?" antes de começar o trabalho.
 */
async function checkCookie() {
  if (!cookie) {
    console.log("✗ Nenhum cookie configurado.");
    console.log("  Rode `npm run login:shopee` para gerar um automaticamente,");
    console.log("  ou crie shopee-cookie.txt na raiz do projeto manualmente.\n");
    process.exitCode = 1;
    return;
  }

  const res = await getJson(
    `https://shopee.com.br/api/v4/search/search_items?by=pop&limit=1&match_id=${SHOP_ID}` +
      `&newest=0&order=desc&page_type=shop&version=2`,
  );

  if (res.networkError) {
    console.log(`✗ Não deu para falar com a Shopee (${res.networkError}).`);
    console.log("  Verifique a conexão e tente de novo — o cookie não foi testado.\n");
    process.exitCode = 1;
    return;
  }

  if (res.status === 200 && !res.data?.error) {
    console.log("✓ Cookie válido — pode rodar `npm run import:shopee`.\n");
    return;
  }

  console.log(`✗ Cookie recusado pela Shopee (HTTP ${res.status}).`);
  console.log("  Provavelmente expirou. Rode `npm run login:shopee` para renovar.\n");
  process.exitCode = 1;
}

async function main() {
  if (process.argv.includes("--check")) {
    await checkCookie();
    return;
  }

  console.log("→ Lendo dados da loja...\n");

  const shop = await getJson(
    `https://shopee.com.br/api/v4/shop/get_shop_detail?username=${SHOP_USERNAME}`,
  );

  if (shop.data?.data) {
    const d = shop.data.data;
    const total = d.rating_good + d.rating_normal + d.rating_bad;
    console.log("ESTATÍSTICAS REAIS DA LOJA (atualize src/config/site.ts):");
    console.log(`  ratingAverage : ${(d.rating_star ?? 0).toFixed(2)}`);
    console.log(`  ratingCount   : ${total}`);
    console.log(`  followers     : ${d.follower_count}`);
    console.log(`  itemCount     : ${d.item_count}`);
    console.log(`  responseRate  : ${d.response_rate}`);
    console.log(`  openedAt      : ${new Date(d.ctime * 1000).toISOString().slice(0, 7)}\n`);
  } else {
    console.warn("! Não foi possível ler os dados da loja.\n");
  }

  console.log("→ Buscando produtos...");
  const collected = [];

  for (let offset = 0; offset < 200; offset += 50) {
    const res = await getJson(
      `https://shopee.com.br/api/v4/search/search_items?by=pop&limit=50&match_id=${SHOP_ID}` +
        `&newest=${offset}&order=desc&page_type=shop&version=2`,
    );

    if (res.status === 403 || res.data?.error) {
      console.warn(`\n! A Shopee bloqueou a listagem (HTTP ${res.status}).`);
      if (cookie) {
        console.warn("  O cookie foi enviado, mas a Shopee recusou.");
        console.warn("  Provavelmente expirou: rode `npm run login:shopee` para renovar.");
      } else {
        console.warn("  Nenhum cookie configurado. Rode `npm run login:shopee`");
        console.warn("  para gerar um automaticamente.");
      }
      console.warn("");
      break;
    }

    const items = res.data?.items ?? [];
    if (items.length === 0) break;

    collected.push(...items.map((entry) => entry.item_basic ?? entry));
    console.log(`  ${collected.length} produtos lidos...`);
    if (items.length < 50) break;
  }

  const result = await writeCatalog(collected, headers);

  if (!result.written) {
    console.error(
      `\n✗ Só foi possível ler ${result.count} produto(s) — não é uma listagem completa.`,
    );
    console.error("  O catálogo atual foi PRESERVADO (nada foi sobrescrito).");
    console.error("  Rode `npm run login:shopee` para importar os produtos.\n");
    process.exitCode = 1;
    return;
  }

  console.log(`\n✓ ${result.count} produto(s) gravados em src/lib/catalog/shopee-catalog.json`);
  console.log("  Rode `npm run build` — o catálogo real já substitui a vitrine.\n");
}

main().catch((error) => {
  console.error("✗ Falha no import:", error);
  process.exitCode = 1;
});
