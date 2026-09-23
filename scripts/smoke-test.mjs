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
 *   • o WhatsApp do site: o diálogo "Atendimento no WhatsApp" abre, clicar
 *     num atendente passa pela rota /api/atendimentos/whatsapp e ela responde
 *     302 para o wa.me; o pedido rápido é um POST (303 para o wa.me)
 *   • o painel (só com login, ver abaixo): início, Pedidos, Atendimento,
 *     Clientes e Tráfego abrem sem erro de console nem de hidratação, sem o
 *     aviso de migration faltando, e os checkboxes de pedidos ligados ao
 *     formulário de ações em massa pelo atributo `form=` funcionam
 *
 * NADA É GRAVADO: as chamadas à rota do WhatsApp vão com
 * `Sec-Fetch-Site: cross-site`, que faz a rota redirecionar sem registrar o
 * atendimento (é o mesmo filtro que barra robôs), e a aba que o clique abre
 * recebe uma página simulada no lugar do wa.me — o smoke não enche a fila do
 * painel, não abre conversa e não depende de internet.
 *
 * Painel: defina SMOKE_PAINEL_USUARIO e SMOKE_PAINEL_SENHA (um login do painel
 * do ambiente testado). Sem elas, essa parte é pulada com aviso.
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

/** Telas do painel conferidas quando há login (SMOKE_PAINEL_USUARIO/SENHA). */
const PAINEL = [
  "/painel",
  "/painel/pedidos",
  "/painel/atendimento",
  "/painel/atendimento?aba=fila",
  "/painel/atendimento?aba=meus",
  "/painel/clientes",
  "/painel/trafego",
];

const ROTA_WHATSAPP = "/api/atendimentos/whatsapp";
/**
 * Cabeçalho que faz a rota do WhatsApp redirecionar SEM registrar atendimento
 * (daPropriaLoja em route.ts): o smoke confere o caminho do cliente sem
 * encher a fila do painel do ambiente testado.
 */
const SEM_REGISTRO = { "sec-fetch-site": "cross-site" };

const failures = [];
/** Ligado durante a sondagem proposital de 404, cujo erro de console é esperado. */
let ignoreConsole = false;
const fail = (msg) => {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
};
const pass = (msg) => console.log(`  ✓ ${msg}`);

/** A rota do WhatsApp tem de responder com redirect para o wa.me, e para nenhum outro lugar. */
function conferirRedirect(rotulo, resposta, esperado) {
  const destino = resposta.headers()["location"] ?? "";
  if (resposta.status() === esperado && destino.startsWith("https://wa.me/")) pass(`${rotulo}: ${esperado} para o wa.me`);
  else fail(`${rotulo}: respondeu ${resposta.status()} → ${destino.slice(0, 60) || "(sem destino)"} (esperado ${esperado} para https://wa.me/)`);
}

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
// Conta os campos marcados como inválidos, e não a cor da mensagem: a classe
// muda com o visual, o aria-invalid é o que o leitor de tela anuncia.
const errors = await page.locator('[aria-invalid="true"]').count();
if (errors >= 8) pass(`validação bloqueia envio incompleto (${errors} campos)`);
else fail(`validação mostrou só ${errors} erros`);

await page.fill("#cep", "38400100");
await page.locator("#cep").blur();
await page.waitForTimeout(3000);
const city = await page.inputValue("#city");
if (city.toLowerCase().includes("uberl")) pass(`CEP preenche endereço (${city})`);
else fail(`CEP não preencheu a cidade (recebido: "${city}")`);

console.log("\n▸ Pedido rápido pelo WhatsApp");
// O carrinho ainda tem o item do fluxo de compra. O formulário NÃO é enviado
// pela tela (abriria aba nova e limparia o carrinho): confere-se o formulário e
// a rota recebe os mesmos campos por fora.
await page.goto(`${BASE}/checkout/rapido`, { waitUntil: "networkidle" });
const formularioRapido = page.locator(`form[action$="${ROTA_WHATSAPP}"]`);
if (await formularioRapido.count()) {
  const [metodo, alvo] = await formularioRapido.first().evaluate((form) => [form.getAttribute("method"), form.getAttribute("target")]);
  if (metodo?.toLowerCase() === "post" && alvo === "_blank") pass("pedido rápido é um POST em aba nova (dados do cliente fora da URL)");
  else fail(`pedido rápido: method=${metodo} target=${alvo} (esperado post e _blank)`);
  const campos = await formularioRapido.first().evaluate((form) => Object.fromEntries([...new FormData(form)].map(([chave, valor]) => [chave, String(valor)])));
  const resposta = await page.request.post(BASE + ROTA_WHATSAPP, { form: campos, maxRedirects: 0, headers: SEM_REGISTRO });
  conferirRedirect("pedido rápido", resposta, 303);
} else {
  fail("pedido rápido: formulário para /api/atendimentos/whatsapp não encontrado em /checkout/rapido");
}

console.log("\n▸ WhatsApp do site");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Falar com a Dom Guima no WhatsApp/ }).click();
const dialogo = page.getByRole("dialog", { name: "Atendimento no WhatsApp" });
if (await dialogo.isVisible().catch(() => false)) pass("diálogo \"Atendimento no WhatsApp\" abre");
else fail("diálogo do WhatsApp não abriu");

const destinos = await dialogo.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
if (!destinos.length) fail("diálogo do WhatsApp sem nenhum atendente");
const direto = destinos.filter((href) => !href.startsWith(`${ROTA_WHATSAPP}?`));
if (direto.length) fail(`botão do WhatsApp não passa pela rota de atendimento: ${direto[0].slice(0, 80)}`);

// Clique de verdade no primeiro atendente. A requisição da aba nova é feita
// por fora do navegador (com o cabeçalho que não registra) para conferir o
// 302, e a aba recebe uma página simulada no lugar do redirect: seguir o 302
// levaria ao wa.me de verdade (o Chromium não intercepta o redirect de uma
// resposta simulada), e o smoke não abre conversa nem depende de internet.
let redirecionamento = null;
await context.route(`**${ROTA_WHATSAPP}**`, async (route) => {
  redirecionamento = await route.fetch({ headers: { ...route.request().headers(), ...SEM_REGISTRO }, maxRedirects: 0 });
  await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>WhatsApp (simulado pelo smoke)</title>" });
});
if (destinos.length) {
  const [abaNova] = await Promise.all([
    context.waitForEvent("page", { timeout: 10_000 }).catch(() => null),
    dialogo.locator("a[href]").first().click(),
  ]);
  await abaNova?.waitForLoadState("load", { timeout: 10_000 }).catch(() => {});
  if (abaNova?.url().includes(ROTA_WHATSAPP)) pass("clicar no atendente abre a aba nova pela rota de atendimento");
  else fail(`clicar no atendente abriu ${abaNova?.url() ?? "(nenhuma aba)"} em vez da rota de atendimento`);
  if (redirecionamento) conferirRedirect("clique no atendente", redirecionamento, 302);
  else fail("clique no atendente não chamou /api/atendimentos/whatsapp");
  await abaNova?.close();
}
await context.unrouteAll({ behavior: "ignoreErrors" });

// Cada atendente do diálogo leva ao número DELE: todos no mesmo número é o
// sintoma de o cadastro ter caído na lista errada.
const numeros = [];
for (const href of destinos) {
  const resposta = await page.request.get(BASE + href, { maxRedirects: 0, headers: SEM_REGISTRO });
  const numero = /^https:\/\/wa\.me\/(\d+)/.exec(resposta.headers()["location"] ?? "")?.[1];
  if (resposta.status() === 302 && numero) numeros.push(numero);
  else fail(`atendente ${new URL(href, BASE).searchParams.get("atendente")}: respondeu ${resposta.status()} → ${(resposta.headers()["location"] ?? "").slice(0, 60)}`);
}
if (numeros.length === destinos.length && destinos.length) {
  if (destinos.length > 1 && new Set(numeros).size === 1) fail(`os ${destinos.length} atendentes do diálogo levam ao mesmo número`);
  else pass(`${destinos.length} opção(ões) no diálogo, cada uma com 302 para o próprio wa.me`);
}

console.log("\n▸ Busca");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const input = page.locator('input[placeholder="Buscar produtos..."]:visible').first();
await input.click();
await input.type("suporte", { delay: 50 });
const firstOption = page.getByRole("option").first();
await firstOption.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
const options = await page.getByRole("option").count();
if (options > 0) pass(`autocomplete retorna ${options} sugestões`);
else fail("autocomplete vazio");

console.log("\n▸ Painel");
const usuarioDoPainel = process.env.SMOKE_PAINEL_USUARIO?.trim();
const senhaDoPainel = process.env.SMOKE_PAINEL_SENHA ?? "";
if (!usuarioDoPainel || !senhaDoPainel) {
  console.log("  – pulado: defina SMOKE_PAINEL_USUARIO e SMOKE_PAINEL_SENHA para conferir o painel");
} else {
  await page.goto(`${BASE}/painel/login`, { waitUntil: "networkidle" });
  await page.fill("#username", usuarioDoPainel);
  await page.fill("#password", senhaDoPainel);
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  const entrou = await page.waitForURL((url) => !url.pathname.startsWith("/painel/login"), { timeout: 15_000 }).then(() => true, () => false);
  if (!entrou) {
    fail("login no painel falhou (confira SMOKE_PAINEL_USUARIO e SMOKE_PAINEL_SENHA)");
  } else {
    pass("login no painel");
    for (const rota of PAINEL) {
      const res = await page.goto(BASE + rota, { waitUntil: "networkidle" });
      if (!res || res.status() >= 400) {
        fail(`${rota} respondeu ${res?.status()}`);
        continue;
      }
      // Erros de console e de hidratação já caem no ouvinte global da página.
      const aviso = page.getByText("O banco ainda não tem tudo o que o atendimento usa");
      if (await aviso.count()) fail(`${rota} avisa que falta migration: aplique os arquivos listados na tela antes do deploy`);
      else pass(rota);
    }

    // Os checkboxes ficam FORA do formulário de ações em massa (cada card tem
    // os próprios formulários) e se ligam a ele pelo atributo form=.
    await page.goto(`${BASE}/painel/pedidos`, { waitUntil: "networkidle" });
    const caixas = page.locator('input[type="checkbox"][name="orderIds"][form]');
    if (!(await caixas.count())) {
      console.log("  – nenhum pedido na lista: seleção em massa não conferida");
    } else {
      const ligada = await caixas.first().evaluate((caixa) => Boolean(caixa.form) && caixa.form.id === caixa.getAttribute("form"));
      if (ligada) pass("checkbox de pedido ligado ao formulário de ações em massa (form=)");
      else fail("checkbox de pedido aponta para um formulário que não existe");
      await caixas.first().check();
      if (await page.getByText("1 selecionado(s)").isVisible().catch(() => false)) pass("contagem de selecionados atualiza");
      else fail("marcar um pedido não atualizou a contagem de selecionados");
      await caixas.first().uncheck();
    }
  }
}

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
