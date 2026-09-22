#!/usr/bin/env node
/**
 * VERIFICACAO DOS ATENDIMENTOS (leads)
 * ====================================
 *
 *   npm run verify:leads
 *
 * Executa de verdade, contra o banco configurado em .env.local, o ciclo que o
 * painel faz com um atendimento: criar, dedupe do mesmo visitante (inclusive a
 * troca de atendente dentro da janela), distribuicao automatica (rodizio e
 * menos ocupado — com DOIS CLIQUES SIMULTANEOS no rodizio caindo em atendentes
 * diferentes), puxar para mim, transferir, devolver a fila livre, o atendimento
 * de um pedido do site (vinculo, busca pelo pedido, fechamento como ganho ou
 * perdido) e as contagens exatas que alimentam os cards do painel. Serve para
 * conferir a migration supabase/migrations/202609210002_atendimentos.sql depois
 * de cola-la no SQL Editor — nao ha tabela de controle de migrations neste
 * projeto.
 *
 * O QUE ELE CRIA E APAGA (tudo com prefixo "zz-teste-atendimento"):
 *   - atendimentos de teste em public.leads;
 *   - os audit_logs desses atendimentos.
 * Nenhum atendimento, pedido, produto ou log de verdade e tocado: os
 * atendentes usados sao ids ficticios (zz-teste-atendimento-a/-b/-c/-d), que
 * nao existem no cadastro do painel, e o "pedido" do teste e so um id — nenhuma
 * linha e criada em sales_orders (a atribuicao do pedido pendente e conferida
 * por `npm run verify:ledger`).
 *
 * SO RODA COM SUPABASE CONFIGURADO. No modo local em arquivo
 * (data/admin-leads.json) nao ha RPC nem trava de banco para verificar: ali a
 * fila de gravacao do proprio processo serializa os cliques.
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

const MARCA = "zz-teste-atendimento";
const ATENDENTE_A = `${MARCA}-a`;
const ATENDENTE_B = `${MARCA}-b`;
const CANDIDATOS = [{ id: ATENDENTE_A, name: "Teste A" }, { id: ATENDENTE_B, name: "Teste B" }];

let falhas = 0;
const resultados = [];

function checar(nome, ok, detalhe) {
  resultados.push({ nome, ok, detalhe });
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}

function atendimento(sufixo, extra = {}) {
  return {
    id: `${MARCA}-${sufixo}`,
    kind: "whatsapp_generic",
    customer_name: "Teste automatizado",
    message: "Verificacao de atendimentos",
    page_path: "/",
    created_by: MARCA,
    ...extra,
  };
}

async function criar(sufixo, { extra = {}, mode = "manual", candidates = [], audit = null } = {}) {
  const { data, error } = await db.rpc("create_lead_v1", {
    p_lead: atendimento(sufixo, extra),
    p_candidates: candidates,
    p_mode: mode,
    p_audit: audit,
  });
  if (error) throw new Error(`create_lead_v1 falhou (${sufixo}): ${error.message}`);
  return data;
}

async function atualizar(id, patch, audit = null) {
  const { data, error } = await db.rpc("update_lead_v1", { p_id: id, p_patch: patch, p_audit: audit });
  if (error) throw new Error(`update_lead_v1 falhou (${id}): ${error.message}`);
  return data;
}

async function atendimentosDeTeste() {
  const { data } = await db.from("leads").select("id, seller_id, stage, assigned_by, visitor_id").like("id", `${MARCA}%`);
  return data ?? [];
}

async function limpar() {
  await db.from("audit_logs").delete().like("entity_id", `${MARCA}%`);
  await db.from("audit_logs").delete().eq("actor_id", MARCA);
  await db.from("leads").delete().like("id", `${MARCA}%`);
}

// ---------------------------------------------------------------------------

console.log(`\n→ Projeto ${url.replace(/https:\/\/([^.]+)\..*/, "$1")}\n`);

// Pre-requisito: a migration 202609210002 precisa estar aplicada.
const { error: erroRpc } = await db.rpc("create_lead_v1", { p_lead: atendimento("ping"), p_candidates: [], p_mode: "manual", p_audit: null });
if (erroRpc && /could not find|does not exist|schema cache/i.test(erroRpc.message)) {
  console.error("✗ A migration 202609210002_atendimentos.sql ainda nao foi aplicada.");
  console.error("  Rode o arquivo no SQL Editor da Supabase antes de verificar.\n");
  process.exit(1);
}
if (erroRpc) {
  console.error(`✗ Nao consegui criar o atendimento de ping: ${erroRpc.message}\n`);
  process.exit(1);
}

const jaExistia = (await atendimentosDeTeste()).length;
if (jaExistia) {
  console.log(`  (limpando ${jaExistia} registro(s) de uma execucao anterior)`);
}
await limpar();

const totalAntes = (await db.from("leads").select("*", { count: "exact", head: true })).count;
const logsAntes = (await db.from("audit_logs").select("*", { count: "exact", head: true })).count;

try {
  // -------------------------------------------------------------------------
  console.log("▸ 1. Atendimento do cliente que escolheu o atendente");
  const escolhido = await criar("escolhido", { extra: { seller_id: ATENDENTE_A, assigned_by: "customer" } });
  checar("nasceu com o atendente escolhido", escolhido?.lead?.seller_id === ATENDENTE_A, `seller_id = ${escolhido?.lead?.seller_id}`);
  checar("registrou quem escolheu", escolhido?.lead?.assigned_by === "customer", `assigned_by = ${escolhido?.lead?.assigned_by}`);
  checar("carimbou a hora da atribuicao", Boolean(escolhido?.lead?.assigned_at), `assigned_at = ${escolhido?.lead?.assigned_at}`);
  checar("comecou na etapa Novo", escolhido?.lead?.stage === "new", `stage = ${escolhido?.lead?.stage}`);

  // -------------------------------------------------------------------------
  console.log("\n▸ 2. Atendimento sem escolha vai para a fila livre");
  const fila = await criar("fila");
  checar("ficou sem atendente", fila?.lead?.seller_id === null, `seller_id = ${fila?.lead?.seller_id}`);
  checar("ficou sem carimbo de atribuicao", fila?.lead?.assigned_at === null, `assigned_at = ${fila?.lead?.assigned_at}`);

  // -------------------------------------------------------------------------
  console.log("\n▸ 3. Mesmo visitante clicando 4 vezes: 1 atendimento so");
  const repetidos = await Promise.all(
    Array.from({ length: 4 }, (_, i) => criar(`dedupe-${i}`, { extra: { visitor_id: `${MARCA}-visitante` } })),
  );
  const idsRepetidos = new Set(repetidos.map((r) => r?.lead?.id));
  const reaproveitados = repetidos.filter((r) => r?.already_existed).length;
  const { count: gravadosDoVisitante } = await db.from("leads").select("*", { count: "exact", head: true }).eq("visitor_id", `${MARCA}-visitante`);
  checar("as 4 respostas apontam para o mesmo atendimento", idsRepetidos.size === 1, `${idsRepetidos.size} id(s) distinto(s)`);
  checar("3 respostas vieram do dedupe", reaproveitados === 3, `${reaproveitados} reaproveitada(s)`);
  checar("existe 1 linha no banco para o visitante", gravadosDoVisitante === 1, `${gravadosDoVisitante} linha(s)`);

  // -------------------------------------------------------------------------
  console.log("\n▸ 4. Rodizio: dois cliques simultaneos caem em atendentes diferentes");
  // Atendentes que NUNCA receberam nada. E o cenario mais duro para a trava:
  // sem o pg_advisory_xact_lock as duas transacoes leriam o mesmo retrato
  // ("ninguem recebeu ainda"), o desempate por id mandaria as duas para C e o
  // teste falharia sempre — nao so de vez em quando.
  const RODIZIO = [{ id: `${MARCA}-c`, name: "Teste C" }, { id: `${MARCA}-d`, name: "Teste D" }];
  const rodizio = await Promise.all([
    criar("rodizio-1", { mode: "round_robin", candidates: RODIZIO }),
    criar("rodizio-2", { mode: "round_robin", candidates: RODIZIO }),
  ]);
  const sorteados = rodizio.map((r) => r?.lead?.seller_id);
  checar("os dois receberam atendente", sorteados.every(Boolean), sorteados.join(" / "));
  checar("cairam em atendentes diferentes", new Set(sorteados).size === 2, sorteados.join(" / "));
  checar("marcou a origem automatica", rodizio.every((r) => r?.lead?.assigned_by === "auto:round_robin"), rodizio.map((r) => r?.lead?.assigned_by).join(" / "));

  // Em sequencia (um clique depois do outro) o rodizio alterna: quem esta ha
  // mais tempo sem receber e o proximo.
  const emSequencia = [];
  for (let i = 0; i < 4; i += 1) {
    emSequencia.push((await criar(`rodizio-seq-${i}`, { mode: "round_robin", candidates: RODIZIO }))?.lead?.seller_id);
  }
  const alternou = emSequencia.every((id, i) => i === 0 || id !== emSequencia[i - 1]);
  checar("cliques em sequencia alternam os atendentes", alternou && new Set(emSequencia).size === 2, emSequencia.join(" → "));

  // -------------------------------------------------------------------------
  console.log("\n▸ 5. Menos ocupado: vai para quem tem menos conversa aberta");
  // Depois do item 1, A tem uma conversa aberta e B nenhuma; a contagem e
  // feita aqui em vez de no filtro do PostgREST para o teste nao depender da
  // sintaxe de "not in" do cliente.
  const atuais = await atendimentosDeTeste();
  const abertosPor = (sellerId) => atuais.filter((lead) => lead.seller_id === sellerId && !["won", "lost"].includes(lead.stage)).length;
  const abertosA = abertosPor(ATENDENTE_A);
  const abertosB = abertosPor(ATENDENTE_B);
  const menosOcupado = await criar("menos-ocupado", { mode: "least_busy", candidates: CANDIDATOS });
  const esperado = abertosA <= abertosB ? ATENDENTE_A : ATENDENTE_B;
  checar("foi para quem tinha menos conversas", menosOcupado?.lead?.seller_id === esperado, `A=${abertosA} B=${abertosB} → ${menosOcupado?.lead?.seller_id}`);
  checar("marcou a origem automatica", menosOcupado?.lead?.assigned_by === "auto:least_busy", `assigned_by = ${menosOcupado?.lead?.assigned_by}`);

  // -------------------------------------------------------------------------
  console.log("\n▸ 6. Puxar para mim, transferir e devolver a fila");
  const alvo = fila.lead.id;
  const puxado = await atualizar(alvo, { seller_id: ATENDENTE_A, assigned_by: MARCA }, { actor_id: MARCA, action: "lead.assigned", entity_type: "lead", entity_id: alvo });
  checar("puxar atribuiu o atendimento", puxado?.found && puxado?.lead?.seller_id === ATENDENTE_A, `seller_id = ${puxado?.lead?.seller_id}`);
  checar("gravou quem puxou", puxado?.lead?.assigned_by === MARCA, `assigned_by = ${puxado?.lead?.assigned_by}`);

  const transferido = await atualizar(alvo, { seller_id: ATENDENTE_B, assigned_by: MARCA });
  checar("transferir trocou o atendente", transferido?.lead?.seller_id === ATENDENTE_B, `seller_id = ${transferido?.lead?.seller_id}`);
  checar("renovou o carimbo da atribuicao", new Date(transferido?.lead?.assigned_at) > new Date(puxado?.lead?.assigned_at), `${puxado?.lead?.assigned_at} → ${transferido?.lead?.assigned_at}`);

  const devolvido = await atualizar(alvo, { seller_id: null, assigned_by: MARCA });
  checar("devolver limpou o atendente", devolvido?.lead?.seller_id === null, `seller_id = ${devolvido?.lead?.seller_id}`);
  checar("devolver limpou o carimbo", devolvido?.lead?.assigned_at === null, `assigned_at = ${devolvido?.lead?.assigned_at}`);

  // -------------------------------------------------------------------------
  console.log("\n▸ 7. Etapa fechada carimba (e reabrir limpa) o fechamento");
  const perdido = await atualizar(alvo, { stage: "lost", lost_reason: "price" });
  checar("perdido carimbou closed_at", Boolean(perdido?.lead?.closed_at), `closed_at = ${perdido?.lead?.closed_at}`);
  checar("perdido guardou o motivo", perdido?.lead?.lost_reason === "price", `lost_reason = ${perdido?.lead?.lost_reason}`);
  const reaberto = await atualizar(alvo, { stage: "in_progress" });
  checar("reabrir limpou closed_at", reaberto?.lead?.closed_at === null, `closed_at = ${reaberto?.lead?.closed_at}`);
  checar("reabrir limpou o motivo da perda", reaberto?.lead?.lost_reason === null, `lost_reason = ${reaberto?.lead?.lost_reason}`);

  // -------------------------------------------------------------------------
  console.log("\n▸ 8. Auditoria do atendimento");
  const { count: logs } = await db.from("audit_logs").select("*", { count: "exact", head: true }).eq("entity_id", alvo);
  checar("a acao auditada foi gravada", logs === 1, `${logs} log(s)`);

  // -------------------------------------------------------------------------
  console.log("\n▸ 9. Atualizar atendimento inexistente nao quebra");
  const inexistente = await atualizar(`${MARCA}-nao-existe`, { seller_id: ATENDENTE_A });
  checar("respondeu found = false", inexistente?.found === false, JSON.stringify(inexistente));

  // -------------------------------------------------------------------------
  console.log("\n▸ 10. Trocar de atendente dentro da janela do dedupe");
  // O atendente escolhido faz parte da chave: quem clica em A, muda de ideia e
  // clica em B abriu OUTRA conversa, em outro telefone. Reaproveitar o registro
  // deixaria o painel apontando para quem nao esta falando com o cliente.
  const visitanteTroca = `${MARCA}-visitante-troca`;
  const comA = await criar("troca-a", { extra: { visitor_id: visitanteTroca, seller_id: ATENDENTE_A, assigned_by: "customer" } });
  const comB = await criar("troca-b", { extra: { visitor_id: visitanteTroca, seller_id: ATENDENTE_B, assigned_by: "customer" } });
  const deNovoComA = await criar("troca-a2", { extra: { visitor_id: visitanteTroca, seller_id: ATENDENTE_A, assigned_by: "customer" } });
  checar("mudar de atendente gera atendimento novo", comB?.already_existed === false && comB?.lead?.seller_id === ATENDENTE_B, `already_existed = ${comB?.already_existed}, seller_id = ${comB?.lead?.seller_id}`);
  checar("clicar de novo no mesmo atendente ainda deduplica", deNovoComA?.already_existed === true && deNovoComA?.lead?.id === comA?.lead?.id, `already_existed = ${deNovoComA?.already_existed}, id = ${deNovoComA?.lead?.id}`);

  // -------------------------------------------------------------------------
  console.log("\n▸ 11. Pedido do site: atendimento vinculado ao pedido");
  // O mesmo formato que /api/pedidos manda (registerSiteOrderLead): kind
  // site_checkout, order_id e SEM visitor_id — o dedupe por visitante juntaria
  // dois pedidos diferentes do mesmo navegador num atendimento so.
  const PEDIDO = `${MARCA}-pedido`;
  const doPedido = await criar("pedido-site", {
    extra: { kind: "site_checkout", order_id: PEDIDO, customer_phone: "34999990000", customer_key: "34999990000", items: [{ product_id: "p", product_name: "Produto de teste", quantity: 2 }] },
    mode: "round_robin",
    candidates: RODIZIO,
  });
  checar("nasceu vinculado ao pedido", doPedido?.lead?.order_id === PEDIDO, `order_id = ${doPedido?.lead?.order_id}`);
  checar("o rodizio escolheu o atendente do pedido", RODIZIO.some((c) => c.id === doPedido?.lead?.seller_id), `seller_id = ${doPedido?.lead?.seller_id}`);
  checar("guardou os itens do pedido", doPedido?.lead?.items?.[0]?.quantity === 2, JSON.stringify(doPedido?.lead?.items));
  const { data: achados, error: erroBusca } = await db.from("leads").select("id").in("order_id", [PEDIDO, `${MARCA}-outro-pedido`]);
  checar("busca por lote de pedidos (in order_id) encontra o atendimento", !erroBusca && achados?.length === 1 && achados[0].id === doPedido?.lead?.id, erroBusca?.message ?? `${achados?.length} achado(s)`);

  const ganho = await atualizar(doPedido.lead.id, { stage: "won", seller_id: ATENDENTE_A, assigned_by: MARCA });
  checar("confirmar o pedido fecha como ganho com quem confirmou", ganho?.lead?.stage === "won" && ganho?.lead?.seller_id === ATENDENTE_A && Boolean(ganho?.lead?.closed_at), `stage = ${ganho?.lead?.stage}, seller_id = ${ganho?.lead?.seller_id}`);
  const cancelado = await atualizar(doPedido.lead.id, { stage: "lost", lost_reason: "other", notes: "Pedido cancelado" });
  checar("cancelar o pedido fecha como perdido, motivo outro", cancelado?.lead?.stage === "lost" && cancelado?.lead?.lost_reason === "other", `stage = ${cancelado?.lead?.stage}, lost_reason = ${cancelado?.lead?.lost_reason}`);
  checar("a nota explica o cancelamento", cancelado?.lead?.notes === "Pedido cancelado", `notes = ${cancelado?.lead?.notes}`);
  const soNota = await atualizar(doPedido.lead.id, { notes: "Pedido cancelado · Pedido excluído" });
  checar("acrescentar nota nao reabre nem apaga o motivo", soNota?.lead?.stage === "lost" && soNota?.lead?.lost_reason === "other" && soNota?.lead?.closed_at === cancelado?.lead?.closed_at, `stage = ${soNota?.lead?.stage}, lost_reason = ${soNota?.lead?.lost_reason}`);

  // -------------------------------------------------------------------------
  console.log("\n▸ 12. Contagens exatas dos cards (fila livre e em aberto)");
  // Mesmos filtros de countLeads (src/lib/admin/leads.ts), restritos aos
  // atendimentos de teste: `head` + `count: exact` e `in("stage", abertas)`.
  const ABERTAS = ["new", "in_progress", "quote_sent", "awaiting_payment"];
  const deTeste = await atendimentosDeTeste();
  const esperadoFila = deTeste.filter((lead) => lead.seller_id === null && ABERTAS.includes(lead.stage)).length;
  const { count: contadoFila, error: erroFila } = await db.from("leads").select("*", { count: "exact", head: true })
    .like("id", `${MARCA}%`).is("seller_id", null).in("stage", ABERTAS);
  checar("fila livre contada no banco bate com as linhas", !erroFila && contadoFila === esperadoFila, erroFila?.message ?? `banco ${contadoFila} · linhas ${esperadoFila}`);
  const esperadoA = deTeste.filter((lead) => lead.seller_id === ATENDENTE_A && ABERTAS.includes(lead.stage)).length;
  const { count: contadoA, error: erroA } = await db.from("leads").select("*", { count: "exact", head: true })
    .like("id", `${MARCA}%`).eq("seller_id", ATENDENTE_A).in("stage", ABERTAS);
  checar("em aberto por atendente bate com as linhas", !erroA && contadoA === esperadoA, erroA?.message ?? `banco ${contadoA} · linhas ${esperadoA}`);
} finally {
  console.log("\n▸ Limpeza");
  await limpar();
  const sobraram = (await atendimentosDeTeste()).length;
  const totalDepois = (await db.from("leads").select("*", { count: "exact", head: true })).count;
  const logsDepois = (await db.from("audit_logs").select("*", { count: "exact", head: true })).count;
  console.log(`    atendimentos de teste restantes: ${sobraram}`);
  console.log(`    atendimentos reais: ${totalAntes} → ${totalDepois} (intactos: ${totalDepois >= totalAntes ? "sim" : "NAO"})`);
  console.log(`    logs: ${logsAntes} → ${logsDepois} (intactos: ${logsDepois >= logsAntes ? "sim" : "NAO"})`);
}

console.log(`\n${falhas === 0 ? "✓ Todos os testes passaram" : `✗ ${falhas} teste(s) falharam`} (${resultados.length} verificacoes)\n`);
process.exit(falhas === 0 ? 0 : 1);
