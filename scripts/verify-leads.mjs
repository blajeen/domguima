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
 * menos ocupado), puxar para mim, transferir e devolver a fila livre. Serve
 * para conferir a migration
 * supabase/migrations/202609210002_atendimentos.sql depois de cola-la no SQL
 * Editor — nao ha tabela de controle de migrations neste projeto.
 *
 * O QUE ELE CRIA E APAGA (tudo com prefixo "zz-teste-atendimento"):
 *   - atendimentos de teste em public.leads;
 *   - os audit_logs desses atendimentos.
 * Nenhum atendimento, pedido, produto ou log de verdade e tocado: os
 * atendentes usados sao ids ficticios (zz-teste-atendimento-a/-b), que nao
 * existem no cadastro do painel.
 *
 * SO RODA COM SUPABASE CONFIGURADO. No modo local em arquivo
 * (data/admin-leads.json) nao ha RPC para verificar.
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
  console.log("\n▸ 4. Rodizio: dois atendimentos simultaneos caem em atendentes diferentes");
  const rodizio = await Promise.all([
    criar("rodizio-1", { mode: "round_robin", candidates: CANDIDATOS }),
    criar("rodizio-2", { mode: "round_robin", candidates: CANDIDATOS }),
  ]);
  const sorteados = rodizio.map((r) => r?.lead?.seller_id);
  checar("os dois receberam atendente", sorteados.every(Boolean), sorteados.join(" / "));
  checar("cairam em atendentes diferentes", new Set(sorteados).size === 2, sorteados.join(" / "));
  checar("marcou a origem automatica", rodizio.every((r) => r?.lead?.assigned_by === "auto:round_robin"), rodizio.map((r) => r?.lead?.assigned_by).join(" / "));

  // -------------------------------------------------------------------------
  console.log("\n▸ 5. Menos ocupado: vai para quem tem menos conversa aberta");
  // Depois do rodizio um dos dois ficou com uma conversa a mais; a contagem e
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
