#!/usr/bin/env node
/**
 * FASE 3 — VERIFICACAO DO LIVRO-RAZAO
 * ===================================
 *
 *   npm run verify:ledger
 *
 * Executa de verdade, contra o banco configurado em .env.local, os casos que a
 * auditoria mediu quebrados: pedido simultaneo sumindo, numero repetido, venda
 * abaixo de zero, confirmacao dupla e reenvio do mesmo pedido.
 *
 * O QUE ELE CRIA E APAGA (tudo com prefixo "zz-teste-livro-razao"):
 *   - 1 produto de teste em rascunho (status draft: nao aparece na loja);
 *   - pedidos de teste;
 *   - os movimentos e logs desses pedidos.
 * No fim apaga tudo e devolve o contador do dia ao valor dos pedidos reais.
 * Nenhum produto, pedido, imagem ou log de verdade e tocado.
 *
 * As credenciais sao lidas do .env.local e nunca impressas.
 */

import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });

const url = process.env.SUPABASE_URL?.trim();
const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
if (!url || !key) {
  console.error("\n✗ Faltam SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local.\n");
  process.exit(1);
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const MARCA = "zz-teste-livro-razao";
const PRODUTO = `${MARCA}-produto`;
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

let falhas = 0;
const resultados = [];

function checar(nome, ok, detalhe) {
  resultados.push({ nome, ok, detalhe });
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}

function pedido(requestId, extra = {}) {
  return {
    id: `${MARCA}-${requestId}`,
    request_id: `${MARCA}-${requestId}`,
    status: "completed",
    seller_id: "teste",
    seller_name: "Teste",
    customer: { name: "Teste automatizado" },
    items: [],
    total_units: 0,
    total_cents: 0,
    created_by: MARCA,
    ...extra,
  };
}

function baixa(quantidade) {
  return [{ product_id: PRODUTO, quantity_delta: -quantidade, reason: "sale", note: "{{number}} · teste", actor_id: MARCA }];
}

async function estoqueAtual() {
  const { data } = await db.from("products").select("stock").eq("id", PRODUTO).maybeSingle();
  return data?.stock ?? null;
}

async function definirEstoque(valor) {
  const { error } = await db.from("products").update({ stock: valor }).eq("id", PRODUTO);
  if (error) throw new Error(`Nao consegui ajustar o estoque de teste: ${error.message}`);
}

async function pedidosDeTeste() {
  const { data } = await db.from("sales_orders").select("id, number, status, request_id").like("id", `${MARCA}%`);
  return data ?? [];
}

async function limpar() {
  await db.from("audit_logs").delete().like("entity_id", `${MARCA}%`);
  await db.from("audit_logs").delete().eq("actor_id", MARCA);
  await db.from("sales_orders").delete().like("id", `${MARCA}%`);
  // Os movimentos somem junto com o produto (on delete cascade).
  await db.from("products").delete().eq("id", PRODUTO);

  // Devolve o contador do dia ao maior sequencial dos pedidos REAIS que
  // sobraram; sem isso o proximo pedido de verdade pularia dezenas de numeros.
  const { data: reais } = await db.from("sales_orders").select("number").like("number", `DG-${hoje.replaceAll("-", "")}-%`);
  const maior = (reais ?? []).reduce((max, row) => {
    const seq = Number(String(row.number).split("-").at(-1));
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  if (maior > 0) await db.from("order_number_counters").update({ last_seq: maior }).eq("day", hoje);
  else await db.from("order_number_counters").delete().eq("day", hoje);
  return maior;
}

// ---------------------------------------------------------------------------

console.log(`\n→ Projeto ${url.replace(/https:\/\/([^.]+)\..*/, "$1")} · dia ${hoje}\n`);

// Pre-requisito: a migracao 202609040002 precisa estar aplicada.
const { error: erroRpc } = await db.rpc("create_sales_order_v2", { p_order: { id: `${MARCA}-ping`, request_id: `${MARCA}-ping` }, p_movements: [], p_audit: null });
if (erroRpc && /could not find|does not exist|schema cache/i.test(erroRpc.message)) {
  console.error("✗ A migracao 202609040002_ledger_cutover.sql ainda nao foi aplicada.");
  console.error("  Rode o arquivo no SQL Editor da Supabase antes de verificar.\n");
  process.exit(1);
}
await db.from("sales_orders").delete().eq("id", `${MARCA}-ping`);

const jaExistiaTeste = (await pedidosDeTeste()).length;
if (jaExistiaTeste) {
  console.log(`  (limpando ${jaExistiaTeste} registro(s) de uma execucao anterior)`);
  await limpar();
}

// Produto de teste: rascunho, invisivel na loja.
const { data: categoria } = await db.from("categories").select("id").limit(1).maybeSingle();
if (!categoria) {
  console.error("✗ Nenhuma categoria no banco — nao da para criar o produto de teste.\n");
  process.exit(1);
}
const { error: erroProduto } = await db.from("products").insert({
  id: PRODUTO, name: "Produto de teste do livro-razao", slug: PRODUTO, sku: PRODUTO,
  category_id: categoria.id, price_cents: 1000, stock: 50, status: "draft",
});
if (erroProduto) {
  console.error(`✗ Nao consegui criar o produto de teste: ${erroProduto.message}\n`);
  process.exit(1);
}

const contadorAntes = await db.from("order_number_counters").select("last_seq").eq("day", hoje).maybeSingle();
const movimentosAntes = (await db.from("inventory_movements").select("*", { count: "exact", head: true })).count;
const logsAntes = (await db.from("audit_logs").select("*", { count: "exact", head: true })).count;

try {
  // -------------------------------------------------------------------------
  console.log("▸ 1. 25 pedidos simultaneos: nenhum some, nenhum numero repete");
  const criados = await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      db.rpc("create_sales_order_v2", { p_order: pedido(`concorrente-${i}`), p_movements: [], p_audit: null }),
    ),
  );
  const okApi = criados.filter((r) => !r.error).length;
  const gravados = await pedidosDeTeste();
  const numeros = gravados.map((o) => o.number);
  checar("as 25 chamadas retornaram sucesso", okApi === 25, `${okApi}/25`);
  checar("os 25 pedidos existem no banco", gravados.length === 25, `${gravados.length} gravado(s)`);
  checar("nenhum numero repetido", new Set(numeros).size === numeros.length, `${new Set(numeros).size} numeros distintos`);
  checar("numeracao sequencial sem buraco", (() => {
    const seqs = numeros.map((n) => Number(n.split("-").at(-1))).sort((a, b) => a - b);
    return seqs.every((s, i) => i === 0 || s === seqs[i - 1] + 1);
  })(), numeros.length ? `${numeros.map((n) => n.split("-").at(-1)).sort()[0]} … ${numeros.map((n) => n.split("-").at(-1)).sort().at(-1)}` : "");

  // -------------------------------------------------------------------------
  console.log("\n▸ 2. Mesmo request_id 6 vezes ao mesmo tempo: 1 pedido so");
  const repetidos = await Promise.all(
    Array.from({ length: 6 }, () =>
      db.rpc("create_sales_order_v2", { p_order: pedido("idempotente"), p_movements: [], p_audit: null }),
    ),
  );
  const ids = new Set(repetidos.filter((r) => !r.error).map((r) => r.data?.order?.id));
  const { count: quantos } = await db.from("sales_orders").select("*", { count: "exact", head: true }).eq("request_id", `${MARCA}-idempotente`);
  checar("as 6 respostas apontam para o mesmo pedido", ids.size === 1, `${ids.size} id(s) distinto(s)`);
  checar("existe exatamente 1 linha no banco", quantos === 1, `${quantos} linha(s)`);

  // -------------------------------------------------------------------------
  console.log("\n▸ 3. Ultima unidade disputada por 8 vendas: estoque nao fica negativo");
  await definirEstoque(1);
  const disputa = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      db.rpc("create_sales_order_v2", { p_order: pedido(`disputa-${i}`), p_movements: baixa(1), p_audit: null }),
    ),
  );
  const venceram = disputa.filter((r) => !r.error).length;
  const recusados = disputa.filter((r) => r.error && /ESTOQUE_INSUFICIENTE/.test(r.error.message)).length;
  const estoqueDepois = await estoqueAtual();
  const { count: movimentosDaDisputa } = await db.from("inventory_movements").select("*", { count: "exact", head: true }).eq("product_id", PRODUTO);
  checar("apenas 1 venda passou", venceram === 1, `${venceram} passou(aram), ${recusados} recusada(s) por estoque`);
  checar("estoque parou em 0, nunca negativo", estoqueDepois === 0, `estoque = ${estoqueDepois}`);
  checar("so 1 movimento de estoque foi gravado", movimentosDaDisputa === 1, `${movimentosDaDisputa} movimento(s)`);

  // -------------------------------------------------------------------------
  console.log("\n▸ 4. Confirmacao dupla: 5 cliques simultaneos baixam o estoque 1 vez");
  await definirEstoque(10);
  const { data: pendente, error: erroPendente } = await db.rpc("create_sales_order_v2", {
    p_order: pedido("pendente", { status: "pending" }), p_movements: [], p_audit: null,
  });
  if (erroPendente) throw new Error(`Nao consegui criar o pedido pendente: ${erroPendente.message}`);
  const idPendente = pendente.order.id;
  const confirmacoes = await Promise.all(
    Array.from({ length: 5 }, () =>
      db.rpc("update_sales_order_status_v2", {
        p_id: idPendente,
        p_expected_status: "pending",
        p_patch: { status: "completed", seller_id: "teste", seller_name: "Teste" },
        p_movements: baixa(3),
        p_audit: null,
      }),
    ),
  );
  const aplicadas = confirmacoes.filter((r) => !r.error && r.data?.applied).length;
  const estoqueAposConfirmar = await estoqueAtual();
  const { data: linhaPendente } = await db.from("sales_orders").select("status").eq("id", idPendente).maybeSingle();
  checar("apenas 1 confirmacao foi aplicada", aplicadas === 1, `${aplicadas} de 5`);
  checar("estoque baixou 3 uma unica vez", estoqueAposConfirmar === 7, `10 → ${estoqueAposConfirmar}`);
  checar("pedido ficou completed", linhaPendente?.status === "completed", `status = ${linhaPendente?.status}`);

  // -------------------------------------------------------------------------
  console.log("\n▸ 5. Cancelamento devolve o estoque uma vez so");
  const cancelamentos = await Promise.all(
    Array.from({ length: 4 }, () =>
      db.rpc("update_sales_order_status_v2", {
        p_id: idPendente,
        p_expected_status: "completed",
        p_patch: { status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: MARCA },
        p_movements: [{ product_id: PRODUTO, quantity_delta: 3, reason: "cancellation", note: "teste", actor_id: MARCA }],
        p_audit: null,
      }),
    ),
  );
  const cancelaram = cancelamentos.filter((r) => !r.error && r.data?.applied).length;
  const estoqueAposCancelar = await estoqueAtual();
  checar("apenas 1 cancelamento foi aplicado", cancelaram === 1, `${cancelaram} de 4`);
  checar("estoque voltou para 10", estoqueAposCancelar === 10, `estoque = ${estoqueAposCancelar}`);

  // -------------------------------------------------------------------------
  console.log("\n▸ 6. Nota do movimento recebeu o numero real do pedido");
  const { data: notas } = await db.from("inventory_movements").select("note").eq("product_id", PRODUTO).limit(5);
  const comMarcador = (notas ?? []).filter((m) => String(m.note ?? "").includes("{{number}}")).length;
  const comNumero = (notas ?? []).filter((m) => /DG-\d{8}-\d{3}/.test(String(m.note ?? ""))).length;
  checar("nenhum movimento ficou com o marcador cru", comMarcador === 0, `${comMarcador} com {{number}}`);
  checar("ao menos um movimento tem o numero do pedido", comNumero > 0, `${comNumero} com DG-...`);

  // -------------------------------------------------------------------------
  console.log("\n▸ 7. A coluna batch_id existe (idempotencia das baixas em lote)");
  const { error: erroBatch } = await db.from("inventory_movements").select("batch_id").limit(1);
  checar("inventory_movements.batch_id disponivel", !erroBatch, erroBatch?.message ?? "");
} finally {
  console.log("\n▸ Limpeza");
  const contadorFinal = await limpar();
  const sobraram = (await pedidosDeTeste()).length;
  const movimentosDepois = (await db.from("inventory_movements").select("*", { count: "exact", head: true })).count;
  const logsDepois = (await db.from("audit_logs").select("*", { count: "exact", head: true })).count;
  console.log(`    pedidos de teste restantes: ${sobraram}`);
  console.log(`    produto de teste removido:  ${(await estoqueAtual()) === null ? "sim" : "NAO — remova zz-teste-livro-razao manualmente"}`);
  console.log(`    movimentos: ${movimentosAntes} → ${movimentosDepois} (historico real intacto: ${movimentosDepois >= movimentosAntes ? "sim" : "NAO"})`);
  console.log(`    logs:       ${logsAntes} → ${logsDepois} (historico real intacto: ${logsDepois >= logsAntes ? "sim" : "NAO"})`);
  console.log(`    contador do dia ${hoje}: ${contadorAntes.data?.last_seq ?? "sem linha"} → ${contadorFinal || "sem linha"}`);
}

console.log(`\n${falhas === 0 ? "✓ Todos os testes passaram" : `✗ ${falhas} teste(s) falharam`} (${resultados.length} verificacoes)\n`);
process.exit(falhas === 0 ? 0 : 1);
