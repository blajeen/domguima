// Regression: saving CRM/business metadata cannot issue a stock/catalog write.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = mkdtempSync(path.join(tmpdir(), "dom-private-"));
const env = { ...process.env };
try {
  process.env.SUPABASE_URL = "https://example.invalid"; process.env.SUPABASE_SECRET_KEY = "fake";
  writeFileSync(path.join(temp, "empty.cjs"), "");
  const mockPath = path.join(temp, "supabase.cjs");
  writeFileSync(mockPath, `
    const state = { updated_at: '2026-11-13T15:00:00.000Z', settings: { arbitrary: 'preserved', __operations: { business: { monthlyTargets: {}, campaignBudgets: {}, orderCosts: {} }, crm_workflow: {} } }, writes: [], attempts: 0, audit: [] };
    exports.state = state;
    exports.createSupabaseAdminClient = () => ({
      rpc() { throw new Error('Private annotation attempted catalog RPC'); },
      from(table) {
        const q = { filters: {}, patch: null, rows: null, single: false,
          select() { return this; }, eq(key, value) { this.filters[key] = value; return this; },
          order() { return this; }, limit() { return this; }, maybeSingle() { this.single = true; return this; },
          update(patch) { this.patch = patch; return this; }, insert(rows) { this.rows = rows; return this; },
          then(resolve) {
            if (this.patch) {
              state.writes.push(table); state.attempts++;
              if (state.attempts === 1) { state.settings.concurrent = 'new'; state.updated_at = '2026-11-13T15:00:01.000Z'; return Promise.resolve({ data: [], error: null }).then(resolve); }
              if (this.filters.updated_at !== state.updated_at) return Promise.resolve({ data: [], error: null }).then(resolve);
              state.settings = structuredClone(this.patch.settings);
              state.updated_at = this.patch.updated_at;
              return Promise.resolve({ data: [{ id: 'store' }], error: null }).then(resolve);
            }
            if (this.rows) { state.writes.push(table); state.audit.push(...this.rows); return Promise.resolve({ data: [], error: null }).then(resolve); }
            const data = table === 'store_settings' ? { id: 'store', updated_at: state.updated_at, settings: structuredClone(state.settings) } : [];
            return Promise.resolve({ data, error: null }).then(resolve);
          }
        }; return q;
      }
    });
  `);
  const jiti = createJiti(import.meta.url, { alias: { "@/lib/supabase/admin": mockPath, "@": path.join(root, "src"), "server-only": path.join(temp, "empty.cjs") } });
  const mock = await jiti.import(mockPath);
  const { mutateCatalogState } = await jiti.import(path.join(root, "src/lib/admin/catalog-store.ts"));
  await mutateCatalogState(state => {
    state.operations.business.monthlyTargets["2026-11"] = 100000;
    state.auditLogs.unshift({ id: "audit-test", actor_id: "test", action: "business.target.updated", entity_type: "business", entity_id: "2026-11", before_data: null, after_data: { target: 100000 }, created_at: new Date().toISOString() });
  }, { privateOnly: true });
  assert.equal(mock.state.attempts, 2, "concurrent change retried rather than overwritten");
  assert.equal(mock.state.settings.concurrent, "new");
  assert.equal(mock.state.settings.arbitrary, "preserved");
  assert.equal(mock.state.settings.__operations.business.monthlyTargets["2026-11"], 100000);
  assert.equal(mock.state.audit.length, 1, "one audit entry after successful CAS");
  assert.deepEqual([...new Set(mock.state.writes)], ["store_settings", "audit_logs"], "no products, inventory or sales order writes");
  console.log("private settings ok: CAS retry, concurrent settings preserved, one audit, no catalog/stock writes");
} finally { process.env = env; rmSync(temp, { recursive: true, force: true }); }
