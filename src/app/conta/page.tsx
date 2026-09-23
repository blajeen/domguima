import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles, textLinkStyles } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { social, whatsapp } from "@/config/site";
import { genericMessage } from "@/lib/services/whatsapp";
import { WhatsAppChooser } from "@/components/layout/WhatsAppChooser";

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
          icon="caixa"
          title="Acompanhar meu pedido"
          text="Mande o seu nome ou o número do pedido no WhatsApp e a gente te passa o status na hora."
          whatsappMessage="Olá! Gostaria de acompanhar o status do meu pedido na Dom Guima."
          cta="Falar no WhatsApp"
        />
        <Card
          icon="troca"
          title="Trocas e devoluções"
          text="Veja os prazos e como solicitar a troca ou a devolução de um produto."
          href="/institucional/trocas-e-devolucoes"
          cta="Ver política"
        />
        <Card
          icon="caminhao"
          title="Frete e entrega"
          text="Como funciona o envio, prazos e regiões atendidas."
          href="/institucional/frete-e-entrega"
          cta="Saiba mais"
        />
        <Card
          icon="shopee"
          title="Comprou pela Shopee?"
          text="Pedidos feitos na Shopee são acompanhados pelo aplicativo da própria Shopee."
          href={social.shopee}
          cta="Abrir nossa loja"
          external
        />
      </div>

      <div className="mt-8 rounded-card border border-fio bg-white p-6 text-center">
        <p className="text-sm text-ink-600">
          Precisa de ajuda com qualquer outra coisa?
        </p>
        <WhatsAppChooser
          message={genericMessage}
          className={buttonStyles({ variant: "whatsapp", size: "lg", className: "mt-3" })}
        >
          <Icon name="whatsapp" />
          Falar com a Dom Guima · {whatsapp.display}
        </WhatsAppChooser>
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  text,
  href = "",
  whatsappMessage,
  cta,
  external = false,
}: {
  icon: IconName;
  title: string;
  text: string;
  href?: string;
  /** Quando informado, o card abre a escolha de contato no WhatsApp em vez de um link. */
  whatsappMessage?: string;
  cta: string;
  external?: boolean;
}) {
  // A caixa de 44 px do link já dá o respiro acima do texto; a margem negativa
  // devolve a sobra de baixo para o card não crescer.
  const className = `${textLinkStyles} -mb-3`;

  return (
    <div className="rounded-card border border-fio bg-white p-5">
      <Icon name={icon} size={24} className="text-ouro-texto" />
      <h2 className="mt-3 text-base font-bold text-ink-900">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-600">{text}</p>
      {whatsappMessage ? (
        <WhatsAppChooser message={whatsappMessage} className={className}>
          {cta}
        </WhatsAppChooser>
      ) : external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
          {cta}
        </a>
      ) : (
        <Link href={href} className={className}>
          {cta}
        </Link>
      )}
    </div>
  );
}
