#!/usr/bin/env node
/**
 * IMPORT COM LOGIN NO NAVEGADOR
 * ==============================
 *
 *   npm run login:shopee
 *
 * Abre uma janela de navegador separada — um perfil novo e vazio, sem
 * nenhuma relação com o seu Edge/Chrome do dia a dia, sem ver suas outras
 * abas, favoritos ou logins. Você faz login na Shopee ali, do jeito normal
 * (a senha é digitada direto na página oficial da Shopee; este script nunca
 * vê nem armazena senha nenhuma).
 *
 * Assim que detecta que o login funcionou, ele busca a listagem completa de
 * produtos usando essa mesma sessão autenticada — sem precisar copiar cookie
 * manualmente do DevTools — e grava o catálogo do site. Também salva o
 * cookie da sessão em shopee-cookie.txt, para as próximas importações
 * poderem tentar `npm run import:shopee` direto (mais rápido, sem abrir
 * navegador), enquanto esse cookie continuar valendo.
 *
 * O navegador é fechado sozinho ao final. Nada fica rodando em segundo
 * plano depois que o script termina.
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { COOKIE_FILE, DEFAULT_UA, SHOP_ID, SHOP_USERNAME, writeCatalog } from "./shopee-lib.mjs";

const SHOP_URL = `https://shopee.com.br/${SHOP_USERNAME}`;
const POLL_MS = 4000;
const TIMEOUT_MS = 8 * 60 * 1000; // 8 minutos — dá tempo de digitar senha e passar por OTP/captcha

function searchUrl(offset) {
  return (
    `/api/v4/search/search_items?by=pop&limit=50&match_id=${SHOP_ID}` +
    `&newest=${offset}&order=desc&page_type=shop&version=2`
  );
}

/** Chama a API pelo fetch da própria página — herda a sessão autenticada do navegador. */
async function fetchInPage(page, url) {
  return page.evaluate(async (u) => {
    try {
      const res = await fetch(u, { credentials: "include" });
      const json = await res.json().catch(() => null);
      return { status: res.status, data: json };
    } catch {
      return { status: 0, data: null };
    }
  }, url);
}

console.log("→ Abrindo o navegador (janela separada — não mexe no seu Edge normal).");
console.log(`→ Faça login na Shopee normalmente quando a página abrir em ${SHOP_URL}`);
console.log(`→ Aguardando até ${TIMEOUT_MS / 60000} minutos pelo login...\n`);

const browser = await chromium.launch({ channel: "msedge", headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" }).catch(() => {
  // Segue mesmo se o load inicial falhar — o polling abaixo tenta de novo.
});

const start = Date.now();
let loggedIn = false;

while (Date.now() - start < TIMEOUT_MS) {
  const probe = await fetchInPage(page, searchUrl(0));
  if (probe.status === 200 && !probe.data?.error) {
    loggedIn = true;
    break;
  }
  const secs = Math.round((Date.now() - start) / 1000);
  console.log(`  aguardando login... (${secs}s)`);
  await page.waitForTimeout(POLL_MS);
}

if (!loggedIn) {
  console.log("\n✗ Tempo esgotado sem detectar login. Nada foi alterado — pode rodar de novo.\n");
  await browser.close();
  process.exit(1);
}

console.log("\n✓ Login detectado. Buscando o catálogo completo...");

const collected = [];
for (let offset = 0; offset < 300; offset += 50) {
  const res = await fetchInPage(page, searchUrl(offset));
  const items = res.data?.items ?? [];
  if (items.length === 0) break;
  collected.push(...items.map((entry) => entry.item_basic ?? entry));
  console.log(`  ${collected.length} produtos lidos...`);
  if (items.length < 50) break;
}

// Bônus: salva o cookie para tentativas futuras de `npm run import:shopee`
// sem precisar abrir navegador. Pode não funcionar fora do navegador — a
// Shopee às vezes confere mais sinais que só o cookie — mas não custa tentar.
try {
  const cookies = await context.cookies(SHOP_URL);
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  writeFileSync(COOKIE_FILE, cookieHeader, "utf8");
  console.log(`  cookie salvo em shopee-cookie.txt (${cookies.length} itens)`);
} catch {
  // Não crítico: o catálogo já foi buscado pelo navegador de qualquer forma.
}

await browser.close();

if (collected.length <= 1) {
  console.error(
    `\n✗ Só foi possível ler ${collected.length} produto(s) — não é uma listagem completa.`,
  );
  console.error("  O catálogo atual foi PRESERVADO. Tente rodar de novo.\n");
  process.exitCode = 1;
} else {
  const result = await writeCatalog(collected, { "User-Agent": DEFAULT_UA });
  if (result.written) {
    console.log(`\n✓ ${result.count} produto(s) gravados em src/lib/catalog/shopee-catalog.json`);
    console.log("  Rode `npm run build` — o catálogo real já substitui a vitrine.\n");
  } else {
    console.error("\n✗ Nada foi gravado — listagem incompleta.\n");
    process.exitCode = 1;
  }
}
