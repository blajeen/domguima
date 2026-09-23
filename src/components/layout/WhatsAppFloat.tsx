import { Icon } from "@/components/ui/Icon";
import { whatsapp } from "@/config/site";
import { genericMessage } from "@/lib/services/whatsapp";
import { loadPublicStoreSettings } from "@/lib/catalog/database";
import { WhatsAppChooser } from "./WhatsAppChooser";

/**
 * Botão flutuante de WhatsApp — o canal que a loja já usa para vender.
 *
 * Pílula verde com sombra de flutuação; na pressão desce 1 px, e nada cresce.
 * O ícone é grafite, como nos outros botões de WhatsApp: branco neste verde
 * fica em 2:1.
 *
 * Com a barra de compra fixa à vista (página de produto, abaixo de lg), sobe
 * a altura dela (4rem + área segura) para não ficar em cima do botão de compra.
 */
export async function WhatsAppFloat() {
  const settings = await loadPublicStoreSettings();
  return (
    <div
      data-storefront-chrome
      className="fixed bottom-4 right-4 z-40 transition-[translate] duration-(--duracao-entrada) ease-out sm:bottom-6 sm:right-6 max-lg:[html[data-barra-compra]_&]:-translate-y-[calc(4rem_+_env(safe-area-inset-bottom))]"
    >
      <WhatsAppChooser
        message={genericMessage}
        aria-label={`Falar com a Dom Guima no WhatsApp ${settings.whatsappDisplay || whatsapp.display}`}
        className="group relative flex size-14 items-center justify-center rounded-pill bg-whatsapp text-grafite-900 shadow-float transition-[background-color,translate] duration-(--duracao-toque) ease-out hover:bg-whatsapp-escuro active:translate-y-px"
      >
        <Icon name="whatsapp" size={28} />
        {/* Dica no desktop, ao passar o mouse ou chegar pelo teclado. */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-control bg-grafite-900 px-3 py-1.5 text-xs font-semibold text-papel opacity-0 shadow-float transition-opacity duration-(--duracao-toque) group-hover:opacity-100 group-focus-visible:opacity-100 lg:block"
        >
          Fale com a gente
        </span>
      </WhatsAppChooser>
    </div>
  );
}
