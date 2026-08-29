#!/usr/bin/env node
/**
 * TESTE DE FUMAÇA DA LOJA
 * =======================
 *
 *   npm run dev            (num terminal)
 *   npm run test:smoke     (noutro)
 *
 * Percorre a loja num navegador real e verifica o que costuma quebrar sem
 * ninguém perceber:
 *
 *   • todas as rotas respondem (e a 404 responde 404)
 *   • nenhum erro de console, exceção de JS ou requisição falha
 *   • nenhuma imagem quebrada
 *   • nenhum vazamento horizontal de 320px a 1920px
 *   • o fluxo de compra funciona: adicionar → gaveta → persistir → checkout
 *   • o formulário do checkout valida e o CEP preenche o endereço
 *
 * Sai com código 1 se algo falhar, então serve em CI.
 */

import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:4311";
const VIEWPORTS = [320, 375, 390, 430, 768, 1024, 1366, 1440, 1920];

const ROUTES = [
  "/",
  "/ofertas",
  "/mais-vendidos",
  "/categoria/smart-tvs",
  "/categoria/eletrodomesticos",
  "/categoria/climatizacao",
  "/produto/ferro-vapor-arno-essentialgliss-fv1051b2",
  "/produto/suporte-duplo-para-controle-ps5-0",
  "/busca?q=ventilador",
  "/busca?q=xyznaoexiste",
  "/carrinho",
  "/conta",
  "/institucional/sobre-nos",
  "/institucional/trocas-e-devolucoes",
];

const failures = [];
/** Ligado durante a sondagem proposital de 404, cujo erro de console é esperado. */
let ignoreConsole = false;
const fail = (msg) => {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
};
const pass = (msg) => console.log(`  ✓ ${msg}`);

const browser = await chromium.launch({ channel: process.env.SMOKE_BROWSER ?? "msedge" });
const context = await browser.newContext();
const page = await context.newPage();

page.on("console", (m) => {
  if (m.type() === "error" && !ignoreConsole) {
    fail(`console: ${m.text().slice(0, 120)} (${page.url()})`);
  }
});
page.on("pageerror", (e) => fail(`exceção JS: ${e.message.slice(0, 120)} (${page.url()})`));
page.on("requestfailed", (r) => {
  const err = r.failure()?.errorText ?? "";
  if (!err.includes("ERR_ABORTED")) fail(`requisição falhou: ${r.url().slice(0, 100)}`);
});

console.log(`\n▸ Rotas (${ROUTES.length})`);
for (const route of ROUTES) {
  const res = await page.goto(BASE + route, { waitUntil: "networkidle" });
  if (!res || res.status() >= 400) fail(`${route} respondeu ${res?.status()}`);
  else pass(`${route}`);

  const broken = await page.evaluate(() =>
    [...document.images]
      .filter((i) => i.complete && i.naturalWidth === 0)
      .map((i) => i.currentSrc || i.src),
  );
  for (const src of broken) fail(`imagem quebrada em ${route}: ${src.slice(0, 90)}`);
}

ignoreConsole = true;
const notFound = await page.goto(`${BASE}/rota-inexistente-xyz`);
if (notFound?.status() === 404) pass("404 responde 404");
else fail(`404 respondeu ${notFound?.status()}`);
ignoreConsole = false;

console.log(`\n▸ Responsividade (${VIEWPORTS.join(", ")}px)`);
for (const width of VIEWPORTS) {
  await page.setViewportSize({ width, height: 800 });
  let clean = true;
  for (const route of ["/", "/categoria/climatizacao", "/produto/suporte-duplo-para-controle-ps5-0", "/checkout"]) {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    const over = await page.evaluate(() => {
      const de = document.documentElement;
      return de.scrollWidth - de.clientWidth;
    });
    if (over > 0) {
      fail(`${route} vaza ${over}px na horizontal @${width}px`);
      clean = false;
    }
  }
  if (clean) pass(`${width}px sem vazamento horizontal`);
}

console.log("\n▸ Fluxo de compra");
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${BASE}/categoria/climatizacao`, { waitUntil: "networkidle" });

await page.getByRole("button", { name: /Adicionar .* ao carrinho/ }).first().click();
await page.waitForTimeout(500);

const badge = await page.locator("header").getByText(/^\d+$/).first().textContent();
if (badge === "1") pass("item adicionado ao carrinho");
else fail(`contador do carrinho = ${badge}`);

await page.getByRole("button", { name: /Abrir carrinho/ }).click();
await page.waitForTimeout(500);
if (await page.getByRole("dialog").isVisible()) pass("gaveta do carrinho abre");
else fail("gaveta do carrinho não abriu");

await page.keyboard.press("Escape");
await page.waitForTimeout(400);
if (await page.getByRole("dialog").isVisible().catch(() => false)) {
  fail("Esc não fechou a gaveta");
} else {
  pass("Esc fecha a gaveta");
}

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const persisted = await page.locator("header").getByText(/^\d+$/).first().textContent();
if (persisted === "1") pass("carrinho persiste entre páginas");
else fail("carrinho não persistiu");

console.log("\n▸ Checkout");
await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
if (await page.getByRole("button", { name: "Enviar pedido" }).isVisible() && !(await page.getByRole("button", { name: /WhatsApp/ }).count())) pass("checkout oferece um único envio pelo site");
else fail("checkout ainda exibe mais de um fluxo de envio");
await page.getByRole("button", { name: "Enviar pedido" }).click();
await page.waitForTimeout(400);
const errors = await page.locator("p.text-promo").count();
if (errors >= 8) pass(`validação bloqueia envio incompleto (${errors} campos)`);
else fail(`validação mostrou só ${errors} erros`);

await page.fill("#cep", "38400100");
await page.locator("#cep").blur();
await page.waitForTimeout(3000);
const city = await page.inputValue("#city");
if (city.toLowerCase().includes("uberl")) pass(`CEP preenche endereço (${city})`);
else fail(`CEP não preencheu a cidade (recebido: "${city}")`);

console.log("\n▸ Busca");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const input = page.locator('input[placeholder="Buscar produtos..."]:visible').first();
await input.click();
await input.type("suporte", { delay: 50 });
await page.waitForTimeout(900);
const options = await page.getByRole("option").count();
if (options > 0) pass(`autocomplete retorna ${options} sugestões`);
else fail("autocomplete vazio");

await browser.close();

console.log("\n" + "─".repeat(52));
if (failures.length === 0) {
  console.log("✓ Tudo certo — nenhuma falha encontrada.\n");
} else {
  console.log(`✗ ${failures.length} falha(s):`);
  failures.forEach((f) => console.log(`   • ${f}`));
  console.log();
  process.exitCode = 1;
}
