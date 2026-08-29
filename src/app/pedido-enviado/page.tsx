import type { Metadata } from "next";
import Link from "next/link";
import { whatsapp } from "@/config/site";
import { genericMessage, whatsappLink } from "@/lib/services/whatsapp";

export const metadata: Metadata = {
  title: "Pedido enviado",
  description: "Recebemos o seu pedido na Dom Guima.",
  robots: { index: false, follow: false },
};

export default async function OrderSentPage({ searchParams }: { searchParams: Promise<{ tipo?: string; numero?: string }> }) {
  const params = await searchParams;
  const siteOrder = params.tipo === "site";
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-3xl">
        ✓
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
        {siteOrder ? "Solicitação recebida!" : "Pedido enviado!"}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
        {siteOrder
          ? `Recebemos sua solicitação${params.numero ? ` ${params.numero}` : ""} pelo site. O dono da Dom Guima vai conferir os dados e entrar em contato para confirmar o pedido.`
          : "Abrimos uma conversa no WhatsApp com o resumo do seu pedido. Se a janela não abriu, é só clicar no botão abaixo — o resumo continua lá."}
      </p>
      <p className="mt-4 text-sm text-ink-500">
        {siteOrder
          ? "A confirmação do pedido, do frete, do prazo e do pagamento será feita diretamente com você antes de qualquer cobrança."
          : "Vamos confirmar o frete, o prazo e a forma de pagamento com você antes de qualquer cobrança."}
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a
          href={whatsappLink(genericMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-[#25D366] px-6 py-3 text-sm font-extrabold text-white transition-transform hover:scale-[1.02]"
        >
          {siteOrder ? "Falar com a Dom Guima" : `Abrir WhatsApp ${whatsapp.display}`}
        </a>
        <Link
          href="/"
          className="rounded-xl border border-ink-200 px-6 py-3 text-sm font-semibold text-ink-700 transition-colors hover:border-gold-400 hover:bg-gold-50"
        >
          Continuar comprando
        </Link>
      </div>
    </div>
  );
}
