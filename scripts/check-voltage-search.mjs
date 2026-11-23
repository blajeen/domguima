// Rode com: node scripts/check-voltage-search.mjs
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const src = fileURLToPath(new URL("../src", import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": src } });
const { matchesVoltage, parseVoltageSearch } = await jiti.import("@/lib/catalog/voltage-search.ts");

const search110 = parseVoltageSearch("Ventilador 110V");
const search220 = parseVoltageSearch("ventilador 220 V");
assert.deepEqual(search110, parseVoltageSearch("ventilador 127 volts"));
assert.deepEqual(search110.terms, ["ventilador"]);
assert.deepEqual(search220.terms, ["ventilador"]);
assert.deepEqual(parseVoltageSearch("ventilador 150W").terms, ["ventilador", "150w"]);
assert.equal(parseVoltageSearch("220v").terms.length, 0);

const fan127 = {
  name: "Ventilador de mesa",
  specifications: [{ label: "Tensão", value: "127 V" }],
};
assert.equal(matchesVoltage(fan127, search110.voltages), true);
assert.equal(matchesVoltage(fan127, search220.voltages), false);

const fanWithOptions = {
  ...fan127,
  variantAxis: "Voltagem",
  variantOptions: [{ label: "110V", stock: 0 }, { label: "220V", stock: 1 }],
};
assert.equal(matchesVoltage(fanWithOptions, search110.voltages), false);
assert.equal(matchesVoltage(fanWithOptions, search220.voltages), true);

const legacyFan = {
  name: "Ventilador",
  specifications: [],
  variants: [{ name: "Voltagem", options: ["Bivolt seletivo"] }],
};
assert.equal(matchesVoltage(legacyFan, search110.voltages), true);
assert.equal(matchesVoltage(legacyFan, search220.voltages), true);
assert.equal(matchesVoltage(legacyFan, parseVoltageSearch("ventilador bivolt").voltages), true);

assert.equal(matchesVoltage({ name: "Ventilador 220V", specifications: [] }, search220.voltages), true);
assert.equal(matchesVoltage({ name: "Ventilador 1220V", specifications: [] }, search220.voltages), false);
assert.equal(matchesVoltage({ name: "Ventilador", specifications: [], description: "Compare com o modelo 220V" }, search220.voltages), false);

console.log("Busca por voltagem OK");
