import { whatsapp } from "@/config/site";
import { contactsFor, genericMessage } from "@/lib/services/whatsapp";
import { loadPublicStoreSettings } from "@/lib/catalog/database";
import { WhatsAppChooser, WhatsAppIcon } from "./WhatsAppChooser";

/** Botão flutuante de WhatsApp — o canal que a loja já usa para vender. */
export async function WhatsAppFloat() {
  const settings = await loadPublicStoreSettings();
  return (
    <div data-storefront-chrome className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
      <WhatsAppChooser
        message={genericMessage}
        contacts={contactsFor(settings)}
        aria-label={`Falar com a Dom Guima no WhatsApp ${settings.whatsappDisplay || whatsapp.display}`}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 transition-transform duration-200 hover:scale-105 active:scale-95"
      >
        <WhatsAppIcon className="h-7 w-7" />
        <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 lg:block">
          Fale com a gente
        </span>
      </WhatsAppChooser>
    </div>
  );
}
