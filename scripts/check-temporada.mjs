// Datas dos temas do site. Rode com: npm run test:temporada
import assert from "node:assert/strict";
import { temporadaEm, pascoa, segundoDomingo } from "../src/lib/utils/temporada.ts";
const t = (s) => temporadaEm(new Date(s));
const ymd = (n) => new Date(n * 86_400_000).toISOString().slice(0, 10);
// Datas conhecidas.
assert.equal(ymd(pascoa(2025)), "2025-04-20");
assert.equal(ymd(pascoa(2026)), "2026-04-05");
assert.equal(ymd(pascoa(2027)), "2027-03-28");
assert.equal(ymd(segundoDomingo(2026, 5)), "2026-05-10");
assert.equal(ymd(segundoDomingo(2027, 5)), "2027-05-09");
assert.equal(ymd(segundoDomingo(2026, 8)), "2026-08-09");
assert.equal(ymd(segundoDomingo(2027, 8)), "2027-08-08");
// Natal e Virada.
assert.equal(t("2026-11-30T15:00:00-03:00"), null);
assert.equal(t("2026-12-01T00:30:00-03:00"), "natal");
assert.equal(t("2026-12-25T23:00:00-03:00"), "natal");
assert.equal(t("2026-12-26T00:10:00-03:00"), "virada");
assert.equal(t("2027-01-09T23:59:00-03:00"), "virada");
assert.equal(t("2027-01-10T00:00:00-03:00"), null);
// Páscoa, Mães e Pais: 14 dias até a data.
assert.equal(t("2027-03-13T12:00:00-03:00"), null);
assert.equal(t("2027-03-14T12:00:00-03:00"), "pascoa");
assert.equal(t("2027-03-28T23:00:00-03:00"), "pascoa");
assert.equal(t("2027-03-29T12:00:00-03:00"), null);
assert.equal(t("2027-04-25T12:00:00-03:00"), "maes");
assert.equal(t("2027-05-09T12:00:00-03:00"), "maes");
assert.equal(t("2027-05-10T12:00:00-03:00"), null);
assert.equal(t("2027-07-25T12:00:00-03:00"), "pais");
assert.equal(t("2027-08-08T22:00:00-03:00"), "pais");
assert.equal(t("2027-08-09T12:00:00-03:00"), null);
console.log("ok");
