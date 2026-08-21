import type { Metadata } from "next";
import Link from "next/link";
import { social, whatsapp } from "@/config/site";
import { genericMessage, whatsappLink } from "@/lib/services/whatsapp";

export const metadata: Metadata = {
  title: "Meus pedidos",
  description:
    "Acompanhe seus pedidos da Dom Guima e fale direto com o nosso atendimento.",
  alternates: { canonical: "/conta" },
};

/**
 * A venda é assistida pelo WhatsApp. Esta página concentra acompanhamento,
 * trocas e suporte sem prometer uma área de login que a operação não exige.
 */
export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
        Meus pedidos
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        A venda da Dom Guima é assistida. Acompanhamento, dúvidas e suporte são
        resolvidos diretamente com a nossa equipe:
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card
          icon="📦"
          title="Acompanhar meu pedido"
          text="Mande o seu nome ou o número do pedido no WhatsApp e a gente te passa o status na hora."
          href={whatsappLink(
            "Olá! Gostaria de acompanhar o status do meu pedido na Dom Guima.",
          )}
          cta={`Falar no WhatsApp`}
          external
        />
        <Card
          icon="↩️"
          title="Trocas e devoluções"
          text="Veja os prazos e como solicitar a troca ou a devolução de um produto."
          href="/institucional/trocas-e-devolucoes"
          cta="Ver política"
        />
        <Card
          icon="🚚"
          title="Frete e entrega"
          text="Como funciona o envio, prazos e regiões atendidas."
          href="/institucional/frete-e-entrega"
          cta="Saiba mais"
        />
        <Card
          icon="🛍️"
          title="Comprou pela Shopee?"
          text="Pedidos feitos na Shopee são acompanhados pelo aplicativo da própria Shopee."
          href={social.shopee}
          cta="Abrir nossa loja"
          external
        />
      </div>

      <div className="mt-8 rounded-card border border-ink-100 bg-white p-6 text-center shadow-card">
        <p className="text-sm text-ink-600">
          Precisa de ajuda com qualquer outra coisa?
        </p>
        <a
          href={whatsappLink(genericMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-xl bg-brand-700 px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-brand-600"
        >
          Falar com a Dom Guima · {whatsapp.display}
        </a>
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  text,
  href,
  cta,
  external = false,
}: {
  icon: string;
  title: string;
  text: string;
  href: string;
  cta: string;
  external?: boolean;
}) {
  const className =
    "mt-3 inline-block text-sm font-bold text-gold-800 underline-offset-2 hover:underline";

  return (
    <div className="rounded-card border border-ink-100 bg-white p-5 shadow-card">
      <span aria-hidden className="text-2xl">
        {icon}
      </span>
      <h2 className="mt-2 text-base font-bold text-ink-900">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-600">{text}</p>
      {external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
          {cta} →
        </a>
      ) : (
        <Link href={href} className={className}>
          {cta} →
        </Link>
      )}
    </div>
  );
}
