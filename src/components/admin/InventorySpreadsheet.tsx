"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { registerDailySalesAction, saveInventoryCountsAction } from "@/app/painel/actions";
import type { ActionState, InventorySheetMovement, InventorySheetProduct } from "@/lib/admin/types";
import { formatPrice, normalize } from "@/lib/utils/format";

type ViewMode = "count" | "sales";
type StockFilter = "all" | "attention" | "out";
type SortKey = "name" | "price" | "stock";
type Draft = { stock: number; originalStock: number; exitQty: number };
type ImportLine = { rowNumber: number; sku: string; name: string; productId: string | null; stock: number | null; priceCents: number | null; oldPriceCents: number | null; cardInstallment?: { count: number; value: number } | null; issues: string[] };
type ImportPreview = { fileName: string; rows: ImportLine[] };

interface InventorySpreadsheetProps {
  products: InventorySheetProduct[];
  movements: InventorySheetMovement[];
  todayUnits: number;
}

export function InventorySpreadsheet({ products, movements, todayUnits }: InventorySpreadsheetProps) {
  const [sheetProducts, setSheetProducts] = useState(products);
  const [mode, setMode] = useState<ViewMode>("count");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAscending, setSortAscending] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(products.map((product) => [product.id, { stock: product.stock, originalStock: product.stock, exitQty: 0 }])));
  const [feedback, setFeedback] = useState<ActionState>({});
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [isPending, startTransition] = useTransition();
  const salesBatchId = useRef<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => [...new Set(sheetProducts.map((product) => product.category_name))].sort((a, b) => a.localeCompare(b, "pt-BR")), [sheetProducts]);
  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalize(query);
    const filtered = sheetProducts.filter((product) => {
      const draft = drafts[product.id];
      const searchable = normalize(`${product.name} ${product.sku} ${product.category_name}`);
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesCategory = category === "all" || product.category_name === category;
      const matchesStock = stockFilter === "all" || (stockFilter === "out" ? draft.stock === 0 : draft.stock > 0 && draft.stock <= product.low_stock_threshold);
      const matchesStatus = status === "all" || product.status === status;
      return matchesQuery && matchesCategory && matchesStock && matchesStatus;
    });
    return filtered.sort((a, b) => {
      const first = sortKey === "name" ? a.name : sortKey === "price" ? a.price_cents : drafts[a.id].stock;
      const second = sortKey === "name" ? b.name : sortKey === "price" ? b.price_cents : drafts[b.id].stock;
      const result = typeof first === "string" ? first.localeCompare(second as string, "pt-BR") : Number(first) - Number(second);
      return sortAscending ? result : -result;
    });
  }, [category, drafts, query, sheetProducts, sortAscending, sortKey, status, stockFilter]);

  const dirtyCount = sheetProducts.filter((product) => drafts[product.id].stock !== drafts[product.id].originalStock).length;
  const pendingExits = sheetProducts.reduce((total, product) => total + drafts[product.id].exitQty, 0);
  const totalUnits = sheetProducts.reduce((total, product) => total + drafts[product.id].stock, 0);
  const totalValue = sheetProducts.reduce((total, product) => total + drafts[product.id].stock * product.price_cents, 0);
  const attentionCount = sheetProducts.filter((product) => drafts[product.id].stock > 0 && drafts[product.id].stock <= product.low_stock_threshold).length;
  const outOfStockCount = sheetProducts.filter((product) => drafts[product.id].stock === 0).length;
  const hasUnsavedCount = dirtyCount > 0;

  function changeStock(productId: string, value: number) {
    const nextStock = Math.max(0, Math.min(1_000_000, Math.trunc(Number.isFinite(value) ? value : 0)));
    setDrafts((current) => {
      const draft = current[productId];
      return { ...current, [productId]: { ...draft, stock: nextStock, exitQty: Math.min(draft.exitQty, nextStock) } };
    });
    setFeedback({});
  }

  function changeExit(productId: string, value: number) {
    setDrafts((current) => {
      const draft = current[productId];
      const nextExit = Math.max(0, Math.min(draft.stock, Math.trunc(Number.isFinite(value) ? value : 0)));
      return { ...current, [productId]: { ...draft, exitQty: nextExit } };
    });
    salesBatchId.current = null;
    setFeedback({});
  }

  function stepStock(productId: string, amount: number) { changeStock(productId, drafts[productId].stock + amount); }
  function stepExit(productId: string, amount: number) { changeExit(productId, drafts[productId].exitQty + amount); }

  function saveCounts() {
    const updates = sheetProducts.filter((product) => drafts[product.id].stock !== drafts[product.id].originalStock).map((product) => ({ productId: product.id, expectedStock: drafts[product.id].originalStock, stock: drafts[product.id].stock }));
    if (!updates.length) return;
    setFeedback({});
    startTransition(async () => {
      const result = await saveInventoryCountsAction(updates);
      setFeedback(result);
      if (result.ok) {
        setSheetProducts((current) => current.map((product) => { const update = updates.find((item) => item.productId === product.id); return update ? { ...product, stock: update.stock } : product; }));
        setDrafts((current) => Object.fromEntries(Object.entries(current).map(([id, draft]) => [id, { ...draft, originalStock: draft.stock }])));
      }
    });
  }

  function registerSales() {
    if (hasUnsavedCount || !pendingExits) return;
    const updates = sheetProducts.filter((product) => drafts[product.id].exitQty > 0).map((product) => ({ productId: product.id, expectedStock: drafts[product.id].originalStock, quantity: drafts[product.id].exitQty }));
    if (!updates.length) return;
    const batchId = salesBatchId.current ?? createBatchId();
    salesBatchId.current = batchId;
    setFeedback({});
    startTransition(async () => {
      const result = await registerDailySalesAction(batchId, updates);
      setFeedback(result);
      if (result.ok) {
        setSheetProducts((current) => current.map((product) => { const update = updates.find((item) => item.productId === product.id); return update ? { ...product, stock: product.stock - update.quantity } : product; }));
        setDrafts((current) => Object.fromEntries(Object.entries(current).map(([id, draft]) => draft.exitQty ? [id, { stock: draft.stock - draft.exitQty, originalStock: draft.originalStock - draft.exitQty, exitQty: 0 }] : [id, draft])));
        salesBatchId.current = null;
      }
    });
  }

  function discardCounts() {
    setDrafts((current) => Object.fromEntries(Object.entries(current).map(([id, draft]) => [id, { ...draft, stock: draft.originalStock, exitQty: 0 }])));
    setFeedback({});
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) setSortAscending((value) => !value);
    else { setSortKey(nextKey); setSortAscending(true); }
  }

  function exportExcel() {
    const header = ["nome_produto", "sku", "estoque", "valor_real", "valor_promocional", "valor_parcelado"];
    const lines = sheetProducts.map((product) => {
      const draft = drafts[product.id];
      const real = product.old_price_cents ?? product.price_cents;
      const promo = product.old_price_cents ? product.price_cents : "";
      const installment = product.installment_count && product.installment_value_cents ? `${product.installment_count}x de ${formatPrice(product.installment_value_cents)}` : "";
      return [product.name, product.sku, draft.stock, formatPrice(real), promo === "" ? "" : formatPrice(Number(promo)), installment].map(csvCell).join(";");
    });
    const blob = new Blob(["\uFEFF", [header.map(csvCell).join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dom-guima-estoque-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function prepareImport(file: File) {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) { setFeedback({ message: "A lista precisa ter um cabeçalho e pelo menos uma linha." }); return; }
    const headers = rows[0].map(importHeader);
    const indexOf = (...names: string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
    const skuIndex = indexOf("sku");
    const nameIndex = indexOf("nome_produto", "produto", "nome");
    const stockIndex = indexOf("estoque", "quantidade");
    const realIndex = indexOf("valor_real", "preco_real", "preco");
    const promoIndex = indexOf("valor_promocional", "preco_promocional", "promocional");
    const installmentIndex = indexOf("valor_parcelado", "parcelado");
    if (skuIndex < 0 || stockIndex < 0 || realIndex < 0) { setFeedback({ message: "A lista precisa conter as colunas SKU, estoque e valor_real." }); return; }
    const productsBySku = new Map(sheetProducts.map((product) => [normalize(product.sku), product]));
    const seen = new Set<string>();
    const previewRows: ImportLine[] = rows.slice(1).map((row, offset) => {
      const rowNumber = offset + 2;
      const sku = String(row[skuIndex] ?? "").trim();
      const name = String(row[nameIndex] ?? "").trim();
      const product = productsBySku.get(normalize(sku));
      const issues: string[] = [];
      if (!sku) issues.push("SKU vazio");
      else if (seen.has(normalize(sku))) issues.push("SKU repetido na lista");
      else seen.add(normalize(sku));
      if (!product) issues.push("SKU não encontrado no catálogo");
      const stockRaw = String(row[stockIndex] ?? "").trim();
      const stock = /^\d+$/.test(stockRaw) ? Number(stockRaw) : null;
      if (stock === null) issues.push("Estoque precisa ser um número inteiro igual ou maior que zero");
      const real = realIndex >= 0 ? parseMoney(row[realIndex]) : null;
      const promo = promoIndex >= 0 ? parseMoney(row[promoIndex]) : null;
      let priceCents: number | null = null;
      let oldPriceCents: number | null = null;
      if (realIndex >= 0 && real === null) issues.push("Valor real inválido");
      if (promoIndex >= 0 && String(row[promoIndex] ?? "").trim() && promo === null) issues.push("Valor promocional inválido");
      if (real !== null) { priceCents = promo ?? real; oldPriceCents = promo !== null ? real : null; if (oldPriceCents !== null && oldPriceCents <= priceCents) issues.push("Valor real deve ser maior que o promocional"); }
      const cardInstallment = installmentIndex >= 0 ? parseInstallment(row[installmentIndex]) : undefined;
      if (installmentIndex >= 0 && String(row[installmentIndex] ?? "").trim() && !cardInstallment) issues.push("Valor parcelado inválido");
      if (cardInstallment && (cardInstallment.count < 2 || cardInstallment.count > 24)) issues.push("Parcelamento deve ficar entre 2x e 24x");
      return { rowNumber, sku, name, productId: product?.id ?? null, stock, priceCents, oldPriceCents, cardInstallment, issues };
    }).filter((row) => row.sku || row.name || row.stock !== null);
    setImportPreview({ fileName: file.name, rows: previewRows });
    setFeedback({});
  }

  function applyImport() {
    if (!importPreview) return;
    const validRows = importPreview.rows.filter((row) => !row.issues.length && row.productId && row.stock !== null && row.priceCents !== null);
    if (!validRows.length) return;
    const updates = validRows.map((row) => { const product = sheetProducts.find((item) => item.id === row.productId)!; return { productId: product.id, expectedStock: product.stock, stock: row.stock!, expectedPriceCents: product.price_cents, priceCents: row.priceCents!, oldPriceCents: row.oldPriceCents, ...(row.cardInstallment !== undefined ? { cardInstallment: row.cardInstallment } : {}) }; });
    setFeedback({});
    startTransition(async () => {
      const result = await saveInventoryCountsAction(updates);
      setFeedback(result);
      if (result.ok) {
        setSheetProducts((current) => current.map((product) => { const row = validRows.find((item) => item.productId === product.id); return row ? { ...product, stock: row.stock!, price_cents: row.priceCents!, old_price_cents: row.oldPriceCents, ...(row.cardInstallment !== undefined ? { installment_count: row.cardInstallment?.count ?? null, installment_value_cents: row.cardInstallment?.value ?? null } : {}) } : product; }));
        setDrafts((current) => Object.fromEntries(Object.entries(current).map(([id, draft]) => { const row = validRows.find((item) => item.productId === id); return row ? [id, { ...draft, stock: row.stock!, originalStock: row.stock!, exitQty: 0 }] : [id, draft]; })));
        setImportPreview(null);
      }
    });
  }

  return <div className="inventory-sheet">
    <div className="inventory-sheet-head">
      <div>
        <p className="inventory-kicker">Controle central da loja</p>
        <div className="flex flex-wrap items-center gap-3"><h2 className="inventory-sheet-title">Planilha de inventário</h2><span className="inventory-live"><span /> Atualizado agora</span></div>
        <p className="inventory-sheet-subtitle">Confira o preço de venda e mantenha o estoque físico sincronizado em poucos cliques.</p>
      </div>
      <div className="inventory-mode-switch" aria-label="Modo da planilha">
        <button type="button" className={mode === "count" ? "is-active" : ""} onClick={() => setMode("count")} aria-pressed={mode === "count"}>Contagem e estoque</button>
        <button type="button" className={mode === "sales" ? "is-active" : ""} onClick={() => setMode("sales")} aria-pressed={mode === "sales"}>Baixas avulsas {pendingExits > 0 && <b>{pendingExits}</b>}</button>
      </div>
    </div>

    <div className="inventory-metrics">
      <Metric label="Produtos na planilha" value={sheetProducts.length.toLocaleString("pt-BR")} detail={`${filteredProducts.length} visíveis`} tone="blue" />
      <Metric label="Unidades em estoque" value={totalUnits.toLocaleString("pt-BR")} detail={`${formatPrice(totalValue)} em valor de venda`} tone="gold" />
      <Metric label="Estoque em atenção" value={attentionCount.toLocaleString("pt-BR")} detail={`${outOfStockCount} sem estoque`} tone={attentionCount || outOfStockCount ? "red" : "green"} />
      <Metric label="Saídas registradas hoje" value={todayUnits.toLocaleString("pt-BR")} detail="movimentações confirmadas" tone="violet" />
    </div>

    <div className="inventory-tools">
      <label className="inventory-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto, SKU ou categoria" aria-label="Buscar na planilha" /><kbd>⌘ K</kbd></label>
      <div className="inventory-filters"><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar por categoria"><option value="all">Todas as categorias</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as StockFilter)} aria-label="Filtrar por estoque"><option value="all">Qualquer estoque</option><option value="attention">Estoque baixo</option><option value="out">Sem estoque</option></select><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status"><option value="all">Todos os status</option><option value="active">Publicados</option><option value="draft">Rascunhos</option><option value="archived">Arquivados</option></select></div>
      <div className="inventory-tool-actions"><button type="button" className="inventory-export-action" onClick={exportExcel}>↓ Baixar Excel</button><label className="inventory-import-action">↑ Importar lista<input ref={importInput} type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void prepareImport(file); event.currentTarget.value = ""; }} /></label></div>
    </div>

    {feedback.message && <div className={`inventory-feedback ${feedback.ok ? "is-success" : "is-error"}`} role={feedback.ok ? "status" : "alert"}>{feedback.ok ? "✓" : "!"} {feedback.message}</div>}
    {mode === "sales" && <div className="inventory-context-note">Para vendas, use <strong>Novo pedido</strong>: assim o cliente, vendedor e a comissão ficam registrados. Use esta área apenas para perdas, uso interno ou outras baixas sem pedido.</div>}

    <div className="inventory-grid-wrap" role="region" aria-label="Planilha de produtos" tabIndex={0}>
      <table className="inventory-grid">
        <thead><tr><th className="inventory-product-col"><button type="button" onClick={() => toggleSort("name")}>Produto <SortIcon active={sortKey === "name"} ascending={sortAscending} /></button></th><th>Categoria</th><th><button type="button" onClick={() => toggleSort("price")}>Preço <SortIcon active={sortKey === "price"} ascending={sortAscending} /></button></th>{mode === "count" ? <><th><button type="button" onClick={() => toggleSort("stock")}>Estoque físico <SortIcon active={sortKey === "stock"} ascending={sortAscending} /></button></th><th>Situação</th></> : <><th>Disponível</th><th>Saída do dia</th><th>Após saída</th></>}<th aria-label="Ações" /></tr></thead>
        <tbody>{filteredProducts.map((product) => {
          const draft = drafts[product.id];
          const dirty = draft.stock !== draft.originalStock;
          const afterExit = draft.stock - draft.exitQty;
          return <tr key={product.id} className={dirty ? "is-dirty" : ""}>
            <td className="inventory-product-col"><div className="inventory-product"><div className="inventory-thumb">{product.image_src ? <Image src={product.image_src} alt={product.image_alt} width={48} height={48} sizes="48px" /> : <span aria-hidden="true">DG</span>}</div><div className="min-w-0"><p className="inventory-product-name" title={product.name}>{product.name}</p><p className="inventory-sku">SKU {product.sku}</p></div></div></td>
            <td><span className="inventory-category">{product.category_name}</span></td>
            <td><div className="inventory-price">{formatPrice(product.price_cents)}<Link href={`/painel/produtos/${encodeURIComponent(product.id)}`} aria-label={`Editar preço de ${product.name}`}>Editar</Link></div></td>
            {mode === "count" ? <><td><StockStepper value={draft.stock} onChange={(value) => changeStock(product.id, value)} onStep={(amount) => stepStock(product.id, amount)} label={`Estoque de ${product.name}`} /><span className={dirty ? "inventory-cell-note is-pending" : "inventory-cell-note"}>{dirty ? `era ${draft.originalStock}` : "sincronizado"}</span></td><td><StockStatus stock={draft.stock} threshold={product.low_stock_threshold} /></td></> : <><td><span className={`inventory-available ${draft.stock === 0 ? "is-out" : ""}`}>{draft.stock}</span><span className="inventory-cell-note">unidades</span></td><td><StockStepper value={draft.exitQty} max={draft.stock} onChange={(value) => changeExit(product.id, value)} onStep={(amount) => stepExit(product.id, amount)} label={`Saída de ${product.name}`} /></td><td><span className={`inventory-after ${afterExit === 0 ? "is-zero" : ""}`}>{afterExit}</span><span className="inventory-cell-note">restantes</span></td></>}
            <td><Link href={`/painel/produtos/${encodeURIComponent(product.id)}`} className="inventory-row-action">Abrir</Link></td>
          </tr>;
        })}</tbody>
      </table>
      {!filteredProducts.length && <div className="inventory-empty"><span>⌕</span><strong>Nenhum produto encontrado</strong><p>Tente mudar a busca ou remover algum filtro.</p><button type="button" onClick={() => { setQuery(""); setCategory("all"); setStockFilter("all"); setStatus("all"); }}>Limpar filtros</button></div>}
    </div>

    {importPreview && <ImportPreviewPanel preview={importPreview} isPending={isPending} onCancel={() => setImportPreview(null)} onApply={applyImport} />}

    {mode === "count" && dirtyCount > 0 && <div className="inventory-savebar"><div><strong>{dirtyCount} {dirtyCount === 1 ? "produto alterado" : "produtos alterados"}</strong><span>As alterações só entram na loja quando você salvar.</span></div><div className="inventory-save-actions"><button type="button" className="inventory-secondary-action" onClick={discardCounts} disabled={isPending}>Descartar</button><button type="button" className="inventory-primary-action" onClick={saveCounts} disabled={isPending}>{isPending ? "Salvando..." : "Salvar contagens"}</button></div></div>}
    {mode === "sales" && pendingExits > 0 && <div className="inventory-savebar sales"><div><strong>{pendingExits} {pendingExits === 1 ? "unidade para baixar" : "unidades para baixar"}</strong><span>{hasUnsavedCount ? "Salve as contagens antes de confirmar." : "A baixa ficará registrada como ajuste avulso, sem entrar no relatório de vendas."}</span></div><div className="inventory-save-actions"><button type="button" className="inventory-secondary-action" onClick={() => { setDrafts((current) => Object.fromEntries(Object.entries(current).map(([id, draft]) => [id, { ...draft, exitQty: 0 }]))); salesBatchId.current = null; }} disabled={isPending}>Limpar baixas</button><button type="button" className="inventory-primary-action sales" onClick={registerSales} disabled={isPending || hasUnsavedCount}>{isPending ? "Registrando..." : "Registrar baixas"}</button></div></div>}

    <div className="inventory-guide"><div className="inventory-guide-icon">i</div><div><strong>Fluxo recomendado</strong><p>Faça a contagem física nesta planilha. Para vender e baixar o estoque, abra “Novo pedido” no menu do painel.</p></div><span className="inventory-shortcut"><kbd>Tab</kbd> navega entre células <kbd>+</kbd> / <kbd>−</kbd> ajustam 1 unidade</span></div>

    <section className="inventory-history"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="inventory-kicker">Rastreabilidade</p><h3>Últimos movimentos</h3></div><span className="inventory-history-caption">Cada ajuste fica registrado com data e saldo anterior.</span></div><div className="inventory-history-table-wrap"><table><thead><tr><th>Data</th><th>Produto</th><th>Movimento</th><th>Saldo</th><th>Motivo</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td><time dateTime={movement.created_at}>{movement.created_at.slice(0, 16).replace("T", " ")}</time></td><td><strong>{movement.product_name}</strong></td><td className={movement.quantity_delta > 0 ? "is-entry" : "is-exit"}>{movement.quantity_delta > 0 ? "+" : ""}{movement.quantity_delta}</td><td>{movement.stock_before} <span>→</span> {movement.stock_after}</td><td><span className="inventory-reason">{reasonLabel(movement.reason)}</span>{movement.note && <small>{movement.note}</small>}</td></tr>)}</tbody></table>{!movements.length && <p className="inventory-history-empty">Nenhuma movimentação registrada ainda.</p>}</div></section>
  </div>;
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) { return <div className={`inventory-metric tone-${tone}`}><span className="inventory-metric-dot" /><p>{label}</p><strong>{value}</strong><small>{detail}</small></div>; }
function StockStepper({ value, max, onChange, onStep, label }: { value: number; max?: number; onChange: (value: number) => void; onStep: (amount: number) => void; label: string }) { return <div className="inventory-stepper"><button type="button" onClick={() => onStep(-1)} disabled={value <= 0} aria-label={`Diminuir ${label}`}>−</button><input type="number" min={0} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} aria-label={label} inputMode="numeric" /><button type="button" onClick={() => onStep(1)} disabled={max !== undefined && value >= max} aria-label={`Aumentar ${label}`}>+</button></div>; }
function StockStatus({ stock, threshold }: { stock: number; threshold: number }) { if (stock === 0) return <span className="inventory-status is-out"><i />Esgotado</span>; if (stock <= threshold) return <span className="inventory-status is-low"><i />Atenção</span>; return <span className="inventory-status is-ok"><i />Saudável</span>; }
function ImportPreviewPanel({ preview, isPending, onCancel, onApply }: { preview: ImportPreview; isPending: boolean; onCancel: () => void; onApply: () => void }) {
  const validCount = preview.rows.filter((row) => !row.issues.length).length;
  return <div className="inventory-import-preview" role="dialog" aria-modal="true" aria-labelledby="inventory-import-title"><div className="inventory-import-head"><div><p className="inventory-kicker">Conferência antes de salvar</p><h3 id="inventory-import-title">Importar lista de estoque</h3><p>{preview.fileName} · {preview.rows.length} linhas lidas</p></div><button type="button" onClick={onCancel} aria-label="Fechar prévia">×</button></div><div className="inventory-import-summary"><span className="valid"><b>{validCount}</b> reconhecidas</span><span className={preview.rows.length - validCount ? "invalid" : "valid"}><b>{preview.rows.length - validCount}</b> com problema</span><small>O SKU é usado para localizar o produto. Nome e categoria não são alterados.</small></div><div className="inventory-import-table-wrap"><table><thead><tr><th>Linha</th><th>Produto / SKU</th><th>Estoque</th><th>Valores</th><th>Resultado</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={`${row.rowNumber}-${row.sku}`}><td>{row.rowNumber}</td><td><strong>{row.name || "Produto sem nome"}</strong><small>{row.sku || "SKU vazio"}</small></td><td>{row.stock ?? "—"}</td><td>{row.priceCents !== null ? formatPrice(row.priceCents) : "—"}{row.oldPriceCents !== null && <small>real {formatPrice(row.oldPriceCents)}</small>}</td><td>{row.issues.length ? <span className="import-row-error">{row.issues.join(" · ")}</span> : <span className="import-row-ok">✓ Pronta para aplicar</span>}</td></tr>)}</tbody></table></div><div className="inventory-import-foot"><button type="button" className="inventory-secondary-action" onClick={onCancel} disabled={isPending}>Cancelar</button><button type="button" className="inventory-primary-action" onClick={onApply} disabled={isPending || !validCount}>{isPending ? "Aplicando..." : `Aplicar ${validCount} ${validCount === 1 ? "linha" : "linhas"}`}</button></div></div>;
}
function SortIcon({ active, ascending }: { active: boolean; ascending: boolean }) { return <span className={`inventory-sort ${active ? "is-active" : ""}`}>{active ? ascending ? "↑" : "↓" : "↕"}</span>; }
function reasonLabel(value: string) { return ({ initial_import: "Importação", manual_adjustment: "Ajuste manual", sale: "Venda confirmada", cancellation: "Cancelamento", correction: "Contagem física" } as Record<string, string>)[value] ?? value; }
function createBatchId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `sales-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function csvCell(value: string | number) { const text = String(value); return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function importHeader(value: string) { return normalize(value).replace(/[\s-]+/g, "_"); }
function parseMoney(value: string | undefined) {
  const raw = String(value ?? "").replace(/R\$|\s/g, "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : (raw.match(/\./g)?.length ?? 0) > 1 ? raw.replace(/\./g, "") : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}
function parseInstallment(value: string | undefined) {
  const match = String(value ?? "").match(/(\d+)\s*x[^\d]*([\d.]+(?:,\d{1,2})?)/i);
  if (!match) return null;
  const amount = parseMoney(match[2]);
  return amount ? { count: Number(match[1]), value: amount } : null;
}
function parseCsv(value: string) {
  const text = value.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = text.split("\n", 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === delimiter && !quoted) { row.push(cell.trim()); cell = ""; continue; }
    if (character === "\n" && !quoted) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; continue; }
    cell += character;
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); }
  return rows;
}
