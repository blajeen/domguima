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
      const { data } = await createSupabaseAdminClient()
        .from("admin_users")
        .select("username, name, password_hash, active")
        .eq("username", informado)
        .maybeSingle();
      if (data?.active && senhaConfere(password, data.password_hash)) {
        return { username: data.username, name: data.name };
      }
      // Usuario existe na tabela mas a senha errou: nao cai para o ambiente,
      // senao a senha do dono abriria qualquer nome de usuario cadastrado.
      if (data) return null;
    } catch {
      // Tabela ausente ou banco fora do ar: segue para a conta do ambiente.
    }
  }

  if (informado !== adminConfig.username.toLowerCase()) return null;
  return senhaConfere(password, adminConfig.passwordHash)
    ? { username: adminConfig.username, name: "Dom Guima" }
    : null;
}

export async function createAdminSession(account: AdminAccount) {
  const token = await new SignJWT({ role: "owner", username: account.username, name: account.name })
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
 */
export async function getOwner() {
  if (!hasAdminConfig()) return null;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(adminConfig.sessionSecret), { algorithms: ["HS256"] });
    if (payload.role !== "owner" || typeof payload.username !== "string") return null;
    return { id: payload.username, email: "", name: typeof payload.name === "string" ? payload.name : payload.username };
  } catch { return null; }
}

export async function ownerOrThrow() {
  const owner = await getOwner();
  if (!owner) throw new Error("Acesso nao autorizado.");
  return owner;
}

export async function requireOwner() {
  if (!hasAdminConfig()) redirect("/painel/login?setup=1");
  const owner = await getOwner();
  if (!owner) redirect("/painel/login");
  return owner;
}
