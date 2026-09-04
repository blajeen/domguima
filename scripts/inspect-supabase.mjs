#!/usr/bin/env node
/**
 * FASE 1 — INSPEÇÃO SOMENTE LEITURA DO SUPABASE
 * =============================================
 *
 *   npm run inspect:supabase
 *
 * Só executa SELECT. Nao cria, nao altera e nao apaga nada. Serve para
 * dimensionar a migracao do livro-razao com numero real antes de mexer em
 * qualquer coisa.
 *
 * Le SUPABASE_URL e SUPABASE_SECRET_KEY do .env.local. Os valores nunca sao
 * impressos — apenas a confirmacao de que existem.
 */

import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });

const url = process.env.SUPABASE_URL?.trim();
const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();

if (!url || !key) {
  console.error("\n✗ Credenciais ausentes.\n");
  console.error("  Adicione ao .env.local (sem aspas, sem colar no chat):");
  console.error("    SUPABASE_URL=https://<seu-projeto>.supabase.co");
  console.error("    SUPABASE_SECRET_KEY=<service role key>\n");
  console.error("  Painel da Supabase → Project Settings → API.\n");
  process.exit(1);
}

console.log(`→ Projeto: ${url.replace(/https:\/\/([^.]+)\..*/, "$1")} (chave presente, ${key.length} chars)\n`);

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function contar(tabela) {
  const { count, error } = await db.from(tabela).select("*", { count: "exact", head: true });
  return error ? `erro: ${error.message}` : count;
}

console.log("▸ Volume por tabela");
for (const t of ["categories", "products", "product_images", "inventory_movements", "audit_logs", "store_settings"]) {
  console.log(`    ${t.padEnd(22)} ${await contar(t)}`);
}

console.log("\n▸ Tabelas do livro-razão (ainda não devem existir)");
for (const t of ["sales_orders", "order_number_counters"]) {
  // Sem head:true — numa requisicao HEAD o erro de tabela inexistente vem
  // vazio e a checagem daria falso positivo.
  const { error } = await db.from(t).select("*", { count: "exact" }).limit(0);
  console.log(`    ${t.padEnd(22)} ${error ? "não existe (esperado)" : "JÁ EXISTE — revisar antes de migrar"}`);
}

console.log("\n▸ Pedidos guardados hoje dentro de store_settings.settings.__operations");
const { data: settings, error: settingsError } = await db
  .from("store_settings").select("settings, catalog_enabled, updated_at").eq("id", "store").maybeSingle();

if (settingsError) {
  console.log(`    erro: ${settingsError.message}`);
} else if (!settings) {
  console.log("    nenhuma linha 'store' — banco ainda sem configuração");
} else {
  const ops = settings.settings?.__operations ?? {};
  const orders = Array.isArray(ops.orders) ? ops.orders : [];
  const sellers = Array.isArray(ops.sellers) ? ops.sellers : [];
  const meta = ops.product_meta && typeof ops.product_meta === "object" ? Object.keys(ops.product_meta).length : 0;

  console.log(`    pedidos:        ${orders.length}`);
  console.log(`    vendedores:     ${sellers.length} (${sellers.map((s) => s.name).join(", ") || "—"})`);
  console.log(`    product_meta:   ${meta} produto(s)`);
  console.log(`    atualizado em:  ${settings.updated_at}`);

  if (orders.length) {
    const porStatus = orders.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] ?? 0) + 1 }), {});
    console.log(`    por status:     ${Object.entries(porStatus).map(([k, v]) => `${k}=${v}`).join(", ")}`);

    const numeros = orders.map((o) => o.number);
    const dup = [...new Set(numeros.filter((n, i) => numeros.indexOf(n) !== i))];
    console.log(`    números repetidos: ${dup.length ? dup.join(", ") : "nenhum"}`);

    const semRequestId = orders.filter((o) => !o.request_id).length;
    if (semRequestId) console.log(`    ⚠ ${semRequestId} pedido(s) sem request_id (a coluna unique precisa tolerar isso)`);

    const datas = orders.map((o) => o.created_at).sort();
    console.log(`    intervalo:      ${datas[0]?.slice(0, 10)} até ${datas.at(-1)?.slice(0, 10)}`);

    const campos = [...new Set(orders.flatMap((o) => Object.keys(o)))].sort();
    console.log(`    campos usados:  ${campos.join(", ")}`);
  }
}

console.log("\n▸ Quanto histórico já foi perdido pelo teto de leitura");
const { count: mov } = await db.from("inventory_movements").select("*", { count: "exact", head: true });
const { count: aud } = await db.from("audit_logs").select("*", { count: "exact", head: true });
console.log(`    movimentos: ${mov} (a leitura do app corta em 200 → ${mov > 200 ? `${mov - 200} seriam apagados no próximo salvamento` : "ainda abaixo do teto"})`);
console.log(`    auditoria:  ${aud} (teto de 1000 → ${aud > 1000 ? `${aud - 1000} seriam apagados no próximo salvamento` : "ainda abaixo do teto"})`);

console.log("\n▸ Amostra da estrutura de um pedido (para conferir o schema da tabela nova)");
const amostra = settings?.settings?.__operations?.orders?.[0];
if (amostra) {
  const resumo = { ...amostra, customer: "«objeto»", items: `«${amostra.items?.length ?? 0} item(ns)»` };
  console.log(JSON.stringify(resumo, null, 2).split("\n").map((l) => "    " + l).join("\n"));
} else {
  console.log("    (nenhum pedido para amostrar)");
}

console.log("\n✓ Inspeção concluída — nenhuma alteração foi feita.\n");
