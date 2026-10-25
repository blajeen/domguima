// Teste obrigatorio do dono (25/10/2026): R$ 699,90 em 12x a 11,51% → R$ 65,91.
// Rode com: npm run test:parcela
import assert from "node:assert/strict";
import { simularParcela, TAXAS_PADRAO } from "../src/lib/catalog/parcelamento.ts";

assert.equal(TAXAS_PADRAO[11], 11.51);
assert.equal(simularParcela(69990, 12, TAXAS_PADRAO).parcela, 6591);
console.log("parcela ok: R$ 699,90 → 12x R$ 65,91");
