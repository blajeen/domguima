import { getMissingCrmMigrations } from "@/lib/admin/crm-status";

/**
 * Faixa de aviso quando o banco ainda não tem as migrations do CRM.
 *
 * Sem ela, o painel "degradava" em silêncio: listas vazias e cards zerados que
 * parecem loja sem movimento, e pedidos gravados sem origem. Aparece nas telas
 * que dependem dessas tabelas (início, Pedidos, Atendimento, Clientes e
 * Tráfego) e some sozinha assim que o SQL é aplicado. Componente de servidor:
 * a conferência roda junto com o resto da página, sem nada no navegador.
 */
export async function CrmMigrationNotice({ className = "mb-5" }: { className?: string }) {
  const faltando = await getMissingCrmMigrations();
  if (!faltando.length) return null;

  return (
    <div role="alert" className={`${className} rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900`}>
      <p className="font-black">O banco ainda não tem tudo o que o atendimento usa.</p>
      <p className="mt-1">
        Cole no SQL Editor do Supabase, nesta ordem, {faltando.length === 1 ? "o arquivo abaixo" : "os arquivos abaixo"} (pode rodar de novo sem problema — cada um só cria o que falta):
      </p>
      <ul className="mt-2 space-y-1.5">
        {faltando.map((migration) => (
          <li key={migration.file}>
            <code className="break-all rounded bg-white/70 px-1 font-bold">supabase/migrations/{migration.file}</code> — sem ela, {migration.effect}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-amber-800">
        Depois, no terminal, confira com <code>npm run verify:leads</code> e <code>npm run verify:ledger</code>. Este aviso some sozinho quando o banco estiver completo.
      </p>
    </div>
  );
}
