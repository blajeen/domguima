import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "./config";
import { isMissingLeadSchema } from "./leads";

/**
 * MIGRATIONS DO CRM QUE AINDA NAO ESTAO NO BANCO
 * ==============================================
 *
 * As migrations sao coladas a mao no SQL Editor e nao ha tabela de controle.
 * O codigo sobrevive a rodar antes delas — cada leitura cai no vazio com um
 * console.warn —, mas isso so aparece no log da hospedagem: no painel, a tela
 * de Atendimento dizia "nenhum atendimento corresponde aos filtros", Clientes e
 * os cards do inicio ficavam zerados e os pedidos novos perdiam a origem sem
 * ninguem perceber. Aqui o painel pergunta ao banco se as tres pecas existem,
 * para poder DIZER ao dono o que falta.
 *
 * Cada sonda e uma leitura de uma linha (GET, e nao HEAD: no HEAD o PostgREST
 * nao manda corpo, e o supabase-js transforma o 404 de tabela ausente em
 * "sem erro"). A mesma migration cria a tabela/coluna e a funcao que grava
 * nela, entao a coluna presente responde pelas duas.
 *
 * Sem Supabase (modo local em arquivo) nao ha migration nenhuma: nada falta.
 */

export interface MissingCrmMigration {
  /** Arquivo em supabase/migrations/, na ordem em que deve ser colado. */
  file: string;
  /** O que fica sem funcionar enquanto ela nao for aplicada. */
  effect: string;
}

const ATENDENTES: MissingCrmMigration = {
  file: "202609210001_atendentes.sql",
  effect: "nenhum login pode ser vinculado a um atendente: “Meus atendimentos” e “Puxar para mim” não funcionam.",
};

const ATENDIMENTOS: MissingCrmMigration = {
  file: "202609210002_atendimentos.sql",
  effect: "os atendimentos não são gravados. Os cliques no WhatsApp e os pedidos do site não entram na fila, a tela de Atendimento e os cards de atendimento do painel ficam zerados e Clientes perde o aviso de atendimento em aberto (o WhatsApp continua abrindo para o cliente).",
};

const ORIGEM_DO_PEDIDO: MissingCrmMigration = {
  file: "202609210003_origem_do_pedido.sql",
  effect: "os pedidos novos perdem canal, origem e campanha — a função antiga do banco descarta esses campos, e não há como recuperá-los depois — e o pedido do site não fica ligado ao atendimento.",
};

/** Colunas que a 202609210003 acrescenta a sales_orders. */
const COLUNAS_DE_ORIGEM = "channel, source, attribution, lead_id, customer_key, visitor_id";

/** Depois de conferir que esta tudo la, nao pergunta de novo por 5 minutos (por instancia). */
const CONFERIDO_POR_MS = 5 * 60_000;
let tudoAplicadoAte = 0;

/**
 * As migrations do CRM que faltam, na ordem de aplicacao. Lista vazia = tudo
 * certo (ou nao deu para saber agora: falha de rede nao vira aviso de
 * migration, so console.warn).
 *
 * O resultado "falta" nunca fica em cache: o dono cola o SQL, atualiza a
 * pagina e o aviso some na hora.
 */
export async function getMissingCrmMigrations(): Promise<MissingCrmMigration[]> {
  if (!hasSupabaseConfig() || Date.now() < tudoAplicadoAte) return [];

  try {
    const supabase = createSupabaseAdminClient();
    const [usuarios, atendimentos, pedidos] = await Promise.all([
      supabase.from("admin_users").select("seller_id").limit(1),
      supabase.from("leads").select("id").limit(1),
      supabase.from("sales_orders").select(COLUNAS_DE_ORIGEM).limit(1),
    ]);

    const faltando: MissingCrmMigration[] = [];
    // Tabela admin_users ausente e outra migration (202609110001, logins do
    // banco): sem ela a conta do ambiente segue funcionando, e o aviso aqui e
    // so sobre a coluna do vinculo.
    if (colunaAusente(usuarios.error)) faltando.push(ATENDENTES);
    if (isMissingLeadSchema(atendimentos.error)) faltando.push(ATENDIMENTOS);
    if (colunaAusente(pedidos.error)) faltando.push(ORIGEM_DO_PEDIDO);

    const outroErro = [usuarios.error, atendimentos.error, pedidos.error].find((error) => error && !colunaAusente(error) && !isMissingLeadSchema(error));
    if (outroErro) console.warn("Nao foi possivel conferir as migrations do CRM agora:", outroErro.message);
    if (!faltando.length && !outroErro) tudoAplicadoAte = Date.now() + CONFERIDO_POR_MS;
    return faltando;
  } catch (error) {
    console.warn("Nao foi possivel conferir as migrations do CRM agora:", error);
    return [];
  }
}

/** Coluna que nao existe (e nao a tabela inteira nem uma falha de rede). */
function colunaAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column .+ does not exist|could not find the .+ column/i.test(error.message ?? "");
}
