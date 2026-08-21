#!/usr/bin/env node
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const username = process.argv[2]?.trim() || "domguima";
if (!process.stdin.isTTY) throw new Error("Execute este script em um terminal interativo.");

process.stdout.write(`Configurando o administrador "${username}".\nSenha: `);
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
let password = "";

process.stdin.on("data", (chunk) => {
  for (const key of chunk) {
    if (key === "\u0003") process.exit(130);
    if (key === "\r" || key === "\n") {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      finish();
      return;
    }
    if (key === "\u007f" || key === "\b") {
      password = password.slice(0, -1);
      continue;
    }
    password += key;
  }
});

function finish() {
  if (password.length < 10) throw new Error("A senha precisa ter pelo menos 10 caracteres.");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const currentSessionSecret = existing
    .split(/\r?\n/)
    .find((line) => line.startsWith("ADMIN_SESSION_SECRET="))
    ?.slice("ADMIN_SESSION_SECRET=".length)
    .trim();
  // Password rotation must not rotate the session/encryption secret. Besides
  // signing sessions, this value encrypts the persisted catalog snapshots.
  const sessionSecret = currentSessionSecret || randomBytes(48).toString("base64url");
  const withoutAdmin = existing.split(/\r?\n/).filter((line) => !line.startsWith("ADMIN_USERNAME=") && !line.startsWith("ADMIN_PASSWORD_HASH=") && !line.startsWith("ADMIN_SESSION_SECRET=")).join("\n").trim();
  // Next.js expands unescaped "$NAME" sequences in .env files. Escaping the
  // separators keeps the full scrypt value intact when Next loads .env.local.
  const block = `ADMIN_USERNAME=${username}\nADMIN_PASSWORD_HASH=scrypt\\$${salt}\\$${hash}\nADMIN_SESSION_SECRET=${sessionSecret}`;
  writeFileSync(envPath, `${withoutAdmin}${withoutAdmin ? "\n\n" : ""}${block}\n`, { mode: 0o600 });
  password = "";
  console.log("Conta configurada em .env.local. Reinicie o servidor Next.js.");
}
