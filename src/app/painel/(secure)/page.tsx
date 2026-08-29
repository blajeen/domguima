import Link from "next/link";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { getDashboardData } from "@/lib/admin/data";
import { formatPrice } from "@/lib/utils/format";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const stats = [
    ["Produtos ativos", data.active, "text-success"],
    ["Rascunhos", data.drafts, "text-gold-700"],
    ["Sem estoque", data.outOfStock, "text-red-700"],
    ["Estoque baixo", data.lowStock, "text-orange-700"],
    ["Cadastro incompleto", data.incomplete, "text-ink-700"],
    ["Pedidos aguardando", data.pendingOrders, "text-blue-700"],
  ] as const;

  return (
    <>
      <AdminPageHeader
        eyebrow="Operacao da loja"
        title="Visao geral"
        description="Acompanhe o catalogo sem inventar metricas de faturamento."
        actions={<Link href="/painel/produtos/novo" className="rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-extrabold text-ink-950 hover:bg-gold-300">+ Novo produto</Link>}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {stats.map(([label, value, color]) => (
          <PanelCard key={label} className="p-4">
            <p className="text-xs font-semibold text-ink-500">{label}</p>
            <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
          </PanelCard>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <PanelCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">Alterados recentemente</h2>
            <Link href="/painel/produtos" className="text-xs font-bold text-gold-800 hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-ink-100">
            {data.recent.map((product) => (
              <Link key={product.id} href={`/painel/produtos/${encodeURIComponent(product.id)}`} className="grid grid-cols-[1fr_auto] gap-4 py-3 hover:bg-ink-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink-900">{product.name}</p>
                  <p className="mt-0.5 text-xs text-ink-500">SKU {product.sku} · Estoque {product.stock}</p>
                </div>
                <p className="text-sm font-black">{formatPrice(product.price_cents)}</p>
              </Link>
            ))}
          </div>
        </PanelCard>
        <PanelCard>
          <h2 className="text-lg font-black">Atalhos</h2>
          <div className="mt-4 grid gap-2">
            <QuickLink href="/painel/pedidos/novo" label="Criar novo pedido" />
            <QuickLink href="/painel/pedidos" label="Consultar pedidos" />
            {data.pendingOrders > 0 && <QuickLink href="/painel/pedidos?status=pending" label={`Ver ${data.pendingOrders} pedido(s) aguardando`} />}
            <QuickLink href="/painel/estoque" label="Ajustar estoque" />
            <QuickLink href="/painel/categorias" label="Organizar categorias" />
            <QuickLink href="/painel/catalogo-pdf" label="Exportar catalogo PDF" />
            <QuickLink href="/painel/configuracoes" label="Preencher dados da loja" />
          </div>
        </PanelCard>
      </div>
    </>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="flex items-center justify-between rounded-xl border border-ink-100 px-4 py-3 text-sm font-bold text-ink-700 hover:border-gold-300 hover:bg-gold-50">{label}<span>→</span></Link>;
}
