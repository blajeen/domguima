import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/admin/LoginForm";
import { getOwner } from "@/lib/admin/auth";
import { hasAdminConfig } from "@/lib/admin/config";

export default async function LoginPage() {
  const configured = hasAdminConfig();
  if (configured && await getOwner()) redirect("/painel");
  // `div`, não `main`: o layout raiz já emite <main id="conteudo">, e dois
  // landmarks `main` aninhados confundem leitores de tela.
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-ink-800 bg-white p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-gold-700">Dom Guima</p>
        <h1 className="mt-2 text-2xl font-black text-ink-900">Painel da loja</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-ink-500">Gerencie produtos, precos, estoque, categorias e dados comerciais.</p>
        {!configured && (
          <div className="mb-5 rounded-xl border border-gold-200 bg-gold-50 p-4 text-sm leading-relaxed text-gold-900">
            <strong>Configuração necessária.</strong> Execute <code>npm run setup:admin</code> e reinicie o servidor.
          </div>
        )}
        <LoginForm configured={configured} />
        <Link href="/" className="mt-5 block text-center text-xs font-semibold text-ink-500 hover:text-ink-900">← Voltar para a loja</Link>
      </div>
    </div>
  );
}
