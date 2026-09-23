import type { Metadata } from "next";
import { buttonStyles, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { whatsapp } from "@/config/site";
import { contactsFor, genericMessage } from "@/lib/services/whatsapp";
import { loadPublicStoreSettings } from "@/lib/catalog/database";
import { WhatsAppChooser } from "@/components/layout/WhatsAppChooser";

export const metadata: Metadata = {
  title: "Pedido enviado",
  description: "Recebemos o seu pedido na Dom Guima.",
  robots: { index: false, follow: false },
};

export default async function OrderSentPage({ searchParams }: { searchParams: Promise<{ tipo?: string; numero?: string }> }) {
  const [params, settings] = await Promise.all([searchParams, loadPublicStoreSettings()]);
  const siteOrder = params.tipo === "site";
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-success">
        <Icon name="check" size={32} />
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
        {siteOrder ? "Solicitação recebida!" : "Pedido enviado!"}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
        {siteOrder
          ? `Recebemos sua solicitação${params.numero ? ` ${params.numero}` : ""} pelo site. O dono da Dom Guima vai conferir os dados e entrar em contato para confirmar o pedido.`
          : "Abrimos uma conversa no WhatsApp com o resumo do seu pedido. Se a janela não abriu, é só clicar no botão abaixo: o resumo continua lá."}
      </p>
      <p className="mt-4 text-sm text-ink-500">
        {siteOrder
          ? "A confirmação do pedido, do frete, do prazo e do pagamento será feita diretamente com você antes de qualquer cobrança."
          : "Vamos confirmar o frete, o prazo e a forma de pagamento com você antes de qualquer cobrança."}
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <WhatsAppChooser
          message={genericMessage}
          contacts={contactsFor(settings)}
          className={buttonStyles({ variant: "whatsapp", size: "lg" })}
        >
          <Icon name="whatsapp" />
          {siteOrder ? "Falar com a Dom Guima" : `Abrir WhatsApp ${settings.whatsappDisplay || whatsapp.display}`}
        </WhatsAppChooser>
        <ButtonLink href="/" variant="secundario" size="lg">
          Continuar comprando
        </ButtonLink>
      </div>
    </div>
  );
}
