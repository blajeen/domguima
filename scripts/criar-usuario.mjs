#!/usr/bin/env node
/**
 * CRIA OU ATUALIZA UM USUARIO DO PAINEL
 * =====================================
 *
 *   npm run criar:usuario -- gabriel "Gabriel"
 *   npm run criar:usuario -- gabriel "Gabriel" --vendedor gabriel
 *   npm run criar:usuario -- gabriel "Gabriel" --senha "minha-senha-forte"
 *   npm run criar:usuario -- gabriel --desativar
 *   npm run criar:usuario -- --listar
 *
 * A senha e sorteada aqui e o hash scrypt e calculado AQUI. O banco recebe so
 * o hash — a senha em texto aparece uma unica vez, nesta tela, e nao fica
 * gravada em lugar nenhum. Se perder, gere outra rodando o comando de novo.
 *
 * --vendedor <id> vincula o login a um atendente da lista de Configuracoes
 * (ids como "juliano" e "gabriel"). E assim que o painel sabe qual atendente
 * esta logado. Sem a flag, um usuario ja vinculado continua como esta.
 * Exige a migration 202609210001_atendentes.sql (coluna seller_id).
 *
 * Le SUPABASE_URL e SUPABASE_SECRET_KEY do .env.local; os valores nunca sao
 * impressos.
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomInt, scryptSync } from "node:crypto";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });

const url = process.env.SUPABASE_URL?.trim();
const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
if (!url || !key) {
  console.error("\n✗ Faltam SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local.\n");
  process.exit(1);
}
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

/**
 * Senha legivel de digitar e forte o bastante: 4 blocos de 4 caracteres.
 * Sem letras e numeros que se confundem (O/0, l/1/I) — ela vai ser passada
 * por WhatsApp e digitada a mao.
 */
function sortearSenha() {
  const alfabeto = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bloco = () => Array.from({ length: 4 }, () => alfabeto[randomInt(alfabeto.length)]).join("");
  return `${bloco()}-${bloco()}-${bloco()}-${bloco()}`;
}

function gerarHash(senha) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(senha, salt, 64).toString("hex")}`;
}

const args = process.argv.slice(2);

if (args.includes("--listar")) {
  // `*` e nao a lista de colunas: seller_id so existe depois da migration de
  // atendentes, e a listagem tem de funcionar antes e depois dela.
  const { data, error } = await db.from("admin_users").select("*").order("created_at");
  if (error) {
    console.error(`\n✗ ${error.message}`);
    console.error("  A tabela existe? Aplique supabase/migrations/202609110001_usuarios_do_painel.sql\n");
    process.exit(1);
  }
  console.log(`\n▸ Usuarios do painel no banco: ${data.length}`);
  for (const u of data) {
    console.log(`    ${u.username.padEnd(14)} ${u.name.padEnd(18)} ${(u.active ? "ativo" : "DESATIVADO").padEnd(11)} atendente: ${(u.seller_id ?? "-").padEnd(12)} criado ${u.created_at.slice(0, 10)}`);
  }
  console.log("\n  (a conta de ADMIN_USERNAME continua valendo mesmo sem estar nesta lista)\n");
  process.exit(0);
}

const username = args[0]?.trim().toLowerCase();
if (!username || username.startsWith("--")) {
  console.error("\nUso: npm run criar:usuario -- <usuario> \"<Nome>\" [--senha \"...\"] [--vendedor <atendente>] [--desativar]\n      npm run criar:usuario -- --listar\n");
  process.exit(1);
}
if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
  console.error("\n✗ O usuario deve ter 3 a 40 caracteres: letras minusculas, numeros, ponto, hifen ou sublinhado.\n");
  process.exit(1);
}

if (args.includes("--desativar")) {
  const { error } = await db.from("admin_users").update({ active: false, updated_at: new Date().toISOString() }).eq("username", username);
  if (error) { console.error(`\n✗ ${error.message}\n`); process.exit(1); }
  console.log(`\n✓ "${username}" desativado. A sessao aberta dele expira em ate 12 horas.\n`);
  process.exit(0);
}

const nome = args[1] && !args[1].startsWith("--") ? args[1].trim() : username;
const indiceSenha = args.indexOf("--senha");
const senhaInformada = indiceSenha >= 0 ? args[indiceSenha + 1] : null;
if (senhaInformada && senhaInformada.length < 10) {
  console.error("\n✗ A senha precisa ter pelo menos 10 caracteres.\n");
  process.exit(1);
}
const senha = senhaInformada || sortearSenha();

const indiceVendedor = args.indexOf("--vendedor");
const vendedor = indiceVendedor >= 0 ? (args[indiceVendedor + 1] ?? "").trim().toLowerCase() : null;
if (vendedor !== null && !/^[a-z0-9-]{2,40}$/.test(vendedor)) {
  console.error("\n✗ --vendedor precisa do identificador do atendente (2 a 40 caracteres: letras minusculas, numeros ou hifen), ex.: --vendedor gabriel\n");
  process.exit(1);
}

const { data: existente } = await db.from("admin_users").select("username").eq("username", username).maybeSingle();

// Sem --vendedor a coluna fica fora do payload e o upsert nao mexe no vinculo
// que ja existe.
const { error } = await db.from("admin_users").upsert({
  username, name: nome, password_hash: gerarHash(senha), active: true, updated_at: new Date().toISOString(),
  ...(vendedor !== null ? { seller_id: vendedor } : {}),
}, { onConflict: "username" });

if (error) {
  console.error(`\n✗ ${error.message}`);
  if (/could not find the table|schema cache/i.test(error.message)) {
    console.error("  Aplique supabase/migrations/202609110001_usuarios_do_painel.sql no SQL Editor.\n");
  }
  if (/seller_id/i.test(error.message)) {
    console.error("  A coluna seller_id nao existe: aplique supabase/migrations/202609210001_atendentes.sql no SQL Editor.\n");
  }
  process.exit(1);
}

console.log(`\n✓ Usuario ${existente ? "atualizado" : "criado"}\n`);
console.log("  ┌─────────────────────────────────────────────");
console.log(`  │  Usuario:    ${username}`);
console.log(`  │  Senha:      ${senha}`);
console.log(`  │  Nome:       ${nome}`);
if (vendedor !== null) console.log(`  │  Atendente:  ${vendedor}`);
console.log("  └─────────────────────────────────────────────\n");
if (vendedor === null) {
  console.log("  Sem vinculo novo com atendente. Para o painel saber quem esta logado, rode de novo com");
  console.log("  --vendedor <id> (ex.: juliano, gabriel) — e --senha para nao sortear outra senha.");
}
console.log("  Acesso total ao painel, igual ao dono.");
console.log("  A senha nao fica guardada em lugar nenhum — so o hash foi para o banco.");
console.log("  Para trocar depois, rode o mesmo comando de novo.\n");
