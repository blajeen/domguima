// Conferencias do cadastro assistido: preco na pagina da loja e trava de rede interna.
// Rode com: npm run test:cadastro
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
// shortcut: jiti vem como dependencia indireta (do Tailwind); pôr em devDependencies se ele sair.
import { createJiti } from "jiti";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vazio = path.join(tmpdir(), "server-only-vazio.cjs");
writeFileSync(vazio, "");
const jiti = createJiti(path.join(root, "x.js"), { alias: { "@": path.join(root, "src"), "server-only": vazio } });
const m = await jiti.import(path.join(root, "src/lib/admin/market-price.ts"));
const r = await jiti.import(path.join(root, "src/lib/admin/remote-fetch.ts"));

assert.equal(m.pageHasPrice("<span>R$&nbsp;1.299,90</span>", 129990), true);
assert.equal(m.pageHasPrice("<span>R$ 11.299,90</span>", 129990), false);
assert.equal(m.pageHasPrice('{"price": 699.9}', 69990), true);
assert.equal(m.pageHasPrice("<b>699,90</b>", 69990), true);
assert.equal(m.pageHasPrice("<b>1699,90</b>", 69990), false);

for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "192.168.1.1", "172.20.0.1", "::1", "fd00::1", "::ffff:10.0.0.1", "100.64.0.1", "0.0.0.0"]) assert.equal(r.isPrivateAddress(ip), true, ip);
for (const ip of ["8.8.8.8", "172.15.0.1", "2606:4700::1"]) assert.equal(r.isPrivateAddress(ip), false, ip);
await assert.rejects(r.fetchPublic("http://169.254.169.254/", { maxBytes: 10, accept: () => true }));
await assert.rejects(r.fetchPublic("http://localhost:3000/", { maxBytes: 10, accept: () => true }));
await assert.rejects(r.fetchPublic("file:///etc/passwd", { maxBytes: 10, accept: () => true }));
console.log("cadastro ok");
