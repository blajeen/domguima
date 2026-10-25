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
const t = await jiti.import(path.join(root, "src/lib/admin/product-research.ts"));
const titulos = {
  "soundbar samsung b-series hw-b450f": "Soundbar Samsung B-SERIES HW-B450F",
  "mixer britânia 2 em 1 350w bmx360": "Mixer Britânia 2 em 1 350W BMX360",
  "smart tv lg 50 polegadas 4k uhd": "Smart TV LG 50 Polegadas 4K UHD",
  "guarda-roupa de casal 6 portas": "Guarda-Roupa de Casal 6 Portas",
  "AIR FRYER MONDIAL 4L 1500W 127V": "Air Fryer Mondial 4L 1500W 127V",
  "power bank 10000mah com usb-c": "Power Bank 10000mAh com USB-C",
};
for (const [entrada, esperado] of Object.entries(titulos)) assert.equal(t.formatTitle(entrada), esperado);
console.log("cadastro ok");
