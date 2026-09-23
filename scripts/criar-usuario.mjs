#!/usr/bin/env node
/**
 * CRIA OU ATUALIZA UM USUARIO DO PAINEL
 * =====================================
 *
 *   npm run criar:usuario -- gabriel "Gabriel"
 *   npm run criar:usuario -- gabriel "Gabriel" --vendedor gabriel
 *   npm run criar:usuario -- gabriel "Gabriel" --senha "minha-senha-forte"
 *   npm run criar:usuario -- gabriel --vendedor gabriel      (so vincula; senha e nome ficam)
 *   npm run criar:usuario -- gabriel --desativar
 *   npm run criar:usuario -- --listar
 *
 * A senha e sorteada aqui e o hash scrypt e calculado AQUI. O banco recebe so
 * o hash — a senha em texto aparece uma unica vez, nesta tela, e nao fica
 * gravada em lugar nenhum. Se perder, gere outra rodando o comando de novo
 * (sem --vendedor).
 *
 * --vendedor <id> vincula o login a um atendente da lista de Configuracoes
 * (ids como "juliano" e "gabriel"). E assim que o painel sabe qual atendente
 * esta logado ("Meus atendimentos", "Puxar para mim"). Num usuario que JA
 * existe, --vendedor sem --senha so grava o vinculo: a senha e o nome
 * continuam os mesmos. Era a dica da tela de Atendimento, e sortear senha nova
 * (e trocar o nome pelo usuario) de quem so queria o vinculo trancava a pessoa
 * fora do painel sem aviso. Sem a flag, um usuario ja vinculado continua como
 * esta. Exige a migration 202609210001_atendentes.sql (coluna seller_id).
 *
 * O vinculo vai dentro da sessao: so vale depois de SAIR e ENTRAR de novo.
 *
 * Conta do ambiente (ADMIN_USERNAME): ela nao mora na tabela. Criar a linha
 * dela faz a senha do banco passar a valer no lugar da senha do ambiente — por
 * isso, para essa conta, o comando exige --senha com a senha que vai valer.
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

/** Mesmos ids de src/lib/admin/sellers.ts: o dono era "dom-guima" antes de virar "juliano". */
const ID_LEGADO_DO_DONO = "dom-guima";
const ID_DO_DONO = "juliano";
const ATENDENTES_PADRAO = ["juliano", "gabriel"];
/** Nome que o painel mostra para a conta do ambiente (ver verifyAdminCredentials em auth.ts). */
const NOME_DA_CONTA_DO_AMBIENTE = "Dom Guima";

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

/**
 * Separa as flags dos argumentos soltos.
 *
 * Antes o nome era sempre o 2o argumento: `gabriel --vendedor gabriel` fazia
 * "--vendedor" ser lido como "sem nome" e o usuario virava o proprio nome. Aqui
 * o valor de cada flag e consumido junto com ela, e so o que sobra e usuario e
 * nome, em qualquer ordem de flags.
 */
function lerArgumentos(lista) {
  const COM_VALOR = new Set(["--senha", "--vendedor"]);
  const flags = new Map();
  const soltos = [];
  for (let indice = 0; indice < lista.length; indice += 1) {
    const atual = lista[indice];
    if (COM_VALOR.has(atual)) {
      flags.set(atual, lista[indice + 1] ?? "");
      indice += 1;
    } else if (atual.startsWith("--")) {
      flags.set(atual, true);
    } else {
      soltos.push(atual);
    }
  }
  return { flags, soltos };
}

/**
 * Ids dos atendentes cadastrados em Configuracoes → Atendentes.
 *
 * Um vinculo com id errado (erro de digitacao) deixaria "Puxar para mim"
 * respondendo "o atendente vinculado a este login nao esta ativo" sem dizer por
 * que. Lista nunca gravada = os atendentes padrao do app. `null` = nao deu para
 * ler (o vinculo segue sem conferencia, so com aviso).
 */
async function atendentesCadastrados() {
  const { data, error } = await db.from("store_settings").select("settings").eq("id", "store").maybeSingle();
  if (error) return null;
  const lista = data?.settings?.__operations?.sellers;
  if (!Array.isArray(lista) || !lista.length) return ATENDENTES_PADRAO;
  return lista
    .map((seller) => (typeof seller?.id === "string" ? seller.id.trim().toLowerCase() : ""))
    .filter(Boolean)
    .map((id) => (id === ID_LEGADO_DO_DONO ? ID_DO_DONO : id));
}

function falhar(error) {
  console.error(`\n✗ ${error.message}`);
  if (/seller_id/i.test(error.message)) {
    console.error("  A coluna seller_id nao existe: aplique supabase/migrations/202609210001_atendentes.sql no SQL Editor.\n");
  } else if (/could not find the table|schema cache/i.test(error.message)) {
    console.error("  Aplique supabase/migrations/202609110001_usuarios_do_painel.sql no SQL Editor.\n");
  }
  return 1;
}

const lembreteDoVinculo = [
  "  O vinculo com o atendente vai dentro da sessao: saia do painel e entre de novo",
  "  para \"Meus atendimentos\" e \"Puxar para mim\" passarem a valer.",
];

/**
 * O comando inteiro, devolvendo o codigo de saida.
 *
 * `return` em vez de `process.exit()`: no Windows (Node 24), sair a forca logo
 * depois de uma chamada ao banco derruba o processo com "Assertion failed ...
 * UV_HANDLE_CLOSING" — a conexao do fetch ainda esta fechando — e o codigo de
 * saida vira lixo mesmo quando tudo deu certo.
 */
async function principal() {
  const { flags, soltos } = lerArgumentos(process.argv.slice(2));

  if (flags.has("--listar")) {
    // `*` e nao a lista de colunas: seller_id so existe depois da migration de
    // atendentes, e a listagem tem de funcionar antes e depois dela.
    const { data, error } = await db.from("admin_users").select("*").order("created_at");
    if (error) {
      console.error(`\n✗ ${error.message}`);
      console.error("  A tabela existe? Aplique supabase/migrations/202609110001_usuarios_do_painel.sql\n");
      return 1;
    }
    console.log(`\n▸ Usuarios do painel no banco: ${data.length}`);
    for (const u of data) {
      console.log(`    ${u.username.padEnd(14)} ${u.name.padEnd(18)} ${(u.active ? "ativo" : "DESATIVADO").padEnd(11)} atendente: ${(u.seller_id ?? "-").padEnd(12)} criado ${u.created_at.slice(0, 10)}`);
    }
    console.log("\n  (a conta de ADMIN_USERNAME continua valendo mesmo sem estar nesta lista)\n");
    return 0;
  }

  const username = soltos[0]?.trim().toLowerCase();
  if (!username) {
    console.error("\nUso: npm run criar:usuario -- <usuario> \"<Nome>\" [--senha \"...\"] [--vendedor <atendente>] [--desativar]\n      npm run criar:usuario -- --listar\n");
    return 1;
  }
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    console.error("\n✗ O usuario deve ter 3 a 40 caracteres: letras minusculas, numeros, ponto, hifen ou sublinhado.\n");
    return 1;
  }

  if (flags.has("--desativar")) {
    const { error } = await db.from("admin_users").update({ active: false, updated_at: new Date().toISOString() }).eq("username", username);
    if (error) { console.error(`\n✗ ${error.message}\n`); return 1; }
    console.log(`\n✓ "${username}" desativado. A sessao aberta dele expira em ate 12 horas.\n`);
    return 0;
  }

  const nomeInformado = soltos[1]?.trim() || null;
  const senhaInformada = typeof flags.get("--senha") === "string" && flags.get("--senha") ? flags.get("--senha") : null;
  if (flags.has("--senha") && !senhaInformada) {
    console.error("\n✗ --senha precisa da senha logo depois, entre aspas: --senha \"minha-senha-forte\"\n");
    return 1;
  }
  if (senhaInformada && senhaInformada.length < 10) {
    console.error("\n✗ A senha precisa ter pelo menos 10 caracteres.\n");
    return 1;
  }

  const vendedorBruto = flags.has("--vendedor") ? String(flags.get("--vendedor")).trim().toLowerCase() : null;
  if (vendedorBruto !== null && !/^[a-z0-9-]{2,40}$/.test(vendedorBruto)) {
    console.error("\n✗ --vendedor precisa do identificador do atendente (2 a 40 caracteres: letras minusculas, numeros ou hifen), ex.: --vendedor gabriel\n");
    return 1;
  }
  const vendedor = vendedorBruto === ID_LEGADO_DO_DONO ? ID_DO_DONO : vendedorBruto;
  if (vendedor !== null) {
    const cadastrados = await atendentesCadastrados();
    if (cadastrados === null) {
      console.warn("\n! Nao deu para conferir a lista de atendentes agora; o vinculo sera gravado sem conferencia.");
    } else if (!cadastrados.includes(vendedor)) {
      console.error(`\n✗ Nao existe atendente "${vendedor}" em Configuracoes → Atendentes.`);
      console.error(`  Ids cadastrados: ${cadastrados.join(", ")}\n`);
      return 1;
    }
  }

  // `*`: seller_id so existe depois da migration de atendentes.
  const { data: existente, error: erroDeLeitura } = await db.from("admin_users").select("*").eq("username", username).maybeSingle();
  if (erroDeLeitura) return falhar(erroDeLeitura);

  const contaDoAmbiente = username === (process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();

  // -------------------------------------------------------------------------
  // So o vinculo: usuario que ja existe, --vendedor, sem --senha.
  // -------------------------------------------------------------------------
  if (existente && vendedor !== null && !senhaInformada) {
    const { error } = await db.from("admin_users").update({
      seller_id: vendedor,
      ...(nomeInformado ? { name: nomeInformado } : {}),
      updated_at: new Date().toISOString(),
    }).eq("username", username);
    if (error) return falhar(error);

    console.log(`\n✓ "${username}" vinculado ao atendente "${vendedor}".`);
    console.log(`  A senha continua a mesma${nomeInformado ? "" : `, e o nome continua "${existente.name}"`}.`);
    console.log(`${lembreteDoVinculo.join("\n")}\n`);
    return 0;
  }

  // -------------------------------------------------------------------------
  // Conta do ambiente ainda fora da tabela: criar a linha troca a senha dela.
  // -------------------------------------------------------------------------
  if (!existente && contaDoAmbiente && !senhaInformada) {
    console.error(`\n✗ "${username}" e a conta do ambiente (ADMIN_USERNAME): ela nao esta na tabela de usuarios.`);
    console.error("  Criar a linha dela faz a senha do BANCO passar a valer no lugar da senha do ambiente,");
    console.error("  e sem --senha o comando sortearia uma senha nova — voce perderia a atual sem perceber.");
    console.error("  Para vincular esta conta, diga qual senha vai valer (pode ser a mesma de hoje):\n");
    console.error(`    npm run criar:usuario -- ${username} "${nomeInformado ?? NOME_DA_CONTA_DO_AMBIENTE}"${vendedor ? ` --vendedor ${vendedor}` : ""} --senha "a-senha-que-vai-valer"\n`);
    return 1;
  }

  // -------------------------------------------------------------------------
  // Criar, ou trocar a senha de quem ja existe.
  // -------------------------------------------------------------------------
  const senha = senhaInformada || sortearSenha();
  // O nome so muda quando foi informado: rodar de novo para trocar a senha nao
  // pode renomear a pessoa para o proprio usuario.
  const nome = nomeInformado ?? existente?.name ?? (contaDoAmbiente ? NOME_DA_CONTA_DO_AMBIENTE : username);

  // Sem --vendedor a coluna fica fora do payload e o upsert nao mexe no vinculo
  // que ja existe.
  const { error } = await db.from("admin_users").upsert({
    username, name: nome, password_hash: gerarHash(senha), active: true, updated_at: new Date().toISOString(),
    ...(vendedor !== null ? { seller_id: vendedor } : {}),
  }, { onConflict: "username" });
  if (error) return falhar(error);

  console.log(`\n✓ Usuario ${existente ? "atualizado" : "criado"}\n`);
  console.log("  ┌─────────────────────────────────────────────");
  console.log(`  │  Usuario:    ${username}`);
  console.log(`  │  Senha:      ${senhaInformada ? "(a que voce informou)" : senha}`);
  console.log(`  │  Nome:       ${nome}`);
  if (vendedor !== null) console.log(`  │  Atendente:  ${vendedor}`);
  console.log("  └─────────────────────────────────────────────\n");
  if (contaDoAmbiente && !existente) {
    console.log("  Esta era a conta do ambiente: a partir de agora vale esta senha, e nao mais a do .env.");
  }
  if (existente && !senhaInformada) {
    console.log("  ATENCAO: a senha anterior deixou de valer. Passe a nova para a pessoa.");
  }
  if (vendedor === null) {
    console.log("  Sem vinculo novo com atendente. Para o painel saber quem esta logado, rode:");
    console.log(`    npm run criar:usuario -- ${username} --vendedor <atendente>   (ex.: juliano, gabriel — a senha nao muda)`);
  } else {
    console.log(lembreteDoVinculo.join("\n"));
  }
  console.log("  Acesso total ao painel, igual ao dono.");
  console.log("  A senha nao fica guardada em lugar nenhum — so o hash foi para o banco.");
  console.log("  Para trocar a senha depois, rode de novo sem --vendedor (ou com --senha).\n");
  return 0;
}

process.exitCode = await principal();
