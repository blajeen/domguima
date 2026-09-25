import "server-only";

import { scryptSync, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminConfig, hasAdminConfig, hasSupabaseConfig } from "./config";

const COOKIE_NAME = "domguima_admin_session";
const SESSION_HOURS = 12;

export interface AdminAccount {
  username: string;
  name: string;
  /** Atendente (SellerRecord.id) que este login representa; null = login sem vinculo. */
  sellerId: string | null;
  /**
   * E a conta principal da loja (ADMIN_USERNAME, a "domguima"): so ela ve a
   * venda para lojistas. Vale pela conta do ambiente e tambem pela linha da
   * tabela com o mesmo nome, porque o proprio painel manda a domguima virar
   * usuario da tabela para usar "Meus atendimentos" (npm run criar:usuario --
   * domguima). O username e a chave da tabela e so entra pelo CLI com a chave
   * de servico, entao ninguem cria outra "domguima".
   */
  principal: boolean;
}

/** Quem esta logado no painel, como as paginas e actions enxergam. */
export interface AdminOwner {
  /** O username — e o que vira actor_id/created_by em toda a auditoria. */
  id: string;
  email: string;
  name: string;
  sellerId: string | null;
  /** Ver AdminAccount.principal. */
  principal: boolean;
}

/** Linha de public.admin_users. `seller_id` so existe apos 202609210001_atendentes.sql. */
interface AdminUserRow {
  username: string;
  name: string;
  password_hash: string;
  active: boolean;
  seller_id?: string | null;
}

/**
 * Confere uma senha contra um hash no formato scrypt$salt$hash.
 *
 * Aceita ":" como separador por compatibilidade com instalacoes antigas.
 * `timingSafeEqual` evita que o tempo de resposta revele quantos bytes do
 * hash bateram.
 */
function senhaConfere(password: string, hash: string): boolean {
  const separator = hash.includes(":") ? ":" : "$";
  const [algorithm, salt, expectedHex] = hash.split(separator);
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, expectedHex.length / 2);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Valida o login contra a tabela de usuarios e, como alternativa, contra a
 * conta do ambiente.
 *
 * A conta do ambiente continua valendo de proposito: e a rede de seguranca
 * para o dono nao ficar trancado fora do painel se a tabela sumir, ficar vazia
 * ou o banco cair. Falha de leitura do banco NAO derruba o login dele.
 */
export async function verifyAdminCredentials(username: string, password: string): Promise<AdminAccount | null> {
  if (!hasAdminConfig()) return null;
  const informado = username.trim().toLowerCase();
  if (!informado || !password) return null;

  if (hasSupabaseConfig()) {
    try {
      // `*` em vez da lista de colunas: se o codigo subir antes da migration
      // que cria seller_id, o login por tabela continua funcionando.
      const { data } = await createSupabaseAdminClient()
        .from("admin_users")
        .select("*")
        .eq("username", informado)
        .maybeSingle();
      const row = (data ?? null) as AdminUserRow | null;
      if (row?.active && senhaConfere(password, row.password_hash)) {
        return { username: row.username, name: row.name, sellerId: typeof row.seller_id === "string" && row.seller_id.trim() ? row.seller_id.trim() : null, principal: row.username.toLowerCase() === adminConfig.username.toLowerCase() };
      }
      // Usuario existe na tabela mas a senha errou: nao cai para o ambiente,
      // senao a senha do dono abriria qualquer nome de usuario cadastrado.
      if (row) return null;
    } catch {
      // Tabela ausente ou banco fora do ar: segue para a conta do ambiente.
    }
  }

  if (informado !== adminConfig.username.toLowerCase()) return null;
  return senhaConfere(password, adminConfig.passwordHash)
    ? { username: adminConfig.username, name: "Dom Guima", sellerId: null, principal: true }
    : null;
}

export async function createAdminSession(account: AdminAccount) {
  const token = await new SignJWT({ role: "owner", username: account.username, name: account.name, sellerId: account.sellerId, principal: account.principal })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${SESSION_HOURS}h`)
    .sign(new TextEncoder().encode(adminConfig.sessionSecret));
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function destroyAdminSession() { (await cookies()).delete(COOKIE_NAME); }

/**
 * Quem esta logado, lido do proprio cookie assinado.
 *
 * Nao consulta o banco: isso roda em toda requisicao do painel, e a assinatura
 * do JWT ja prova que a sessao foi emitida por nos. O preco e que desativar um
 * usuario so surte efeito no proximo login — a sessao aberta dura ate 12h.
 *
 * `sellerId` e opcional no token de proposito: sessoes emitidas antes dele
 * existir continuam validas (vem como null) ate expirarem.
 */
export async function getOwner(): Promise<AdminOwner | null> {
  if (!hasAdminConfig()) return null;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(adminConfig.sessionSecret), { algorithms: ["HS256"] });
    if (payload.role !== "owner" || typeof payload.username !== "string") return null;
    return {
      id: payload.username,
      email: "",
      name: typeof payload.name === "string" ? payload.name : payload.username,
      sellerId: typeof payload.sellerId === "string" && payload.sellerId ? payload.sellerId : null,
      // Sessao emitida antes desta marca existir nao e principal: basta sair e
      // entrar de novo com a conta domguima. Mais seguro do que deduzir pelo nome.
      principal: payload.principal === true,
    };
  } catch { return null; }
}

export async function ownerOrThrow() {
  const owner = await getOwner();
  if (!owner) throw new Error("Acesso nao autorizado.");
  return owner;
}

/**
 * Para o que so a conta principal da loja pode ver ou mudar (venda para
 * lojistas). Esconder o item do menu nao protege: toda action e pagina da
 * area confere aqui, no servidor.
 */
export async function contaPrincipalOrThrow() {
  const owner = await ownerOrThrow();
  if (!owner.principal) throw new Error("Esta area e so da conta principal da loja (domguima).");
  return owner;
}

export async function requireOwner() {
  if (!hasAdminConfig()) redirect("/painel/login?setup=1");
  const owner = await getOwner();
  if (!owner) redirect("/painel/login");
  return owner;
}
