import { whatsapp } from "@/config/site";
import { genericMessage, whatsappLink } from "@/lib/services/whatsapp";
import { loadPublicStoreSettings } from "@/lib/catalog/database";

/** Botão flutuante de WhatsApp — o canal que a loja já usa para vender. */
export async function WhatsAppFloat() {
  const settings = await loadPublicStoreSettings();
  return (
    <a
      data-storefront-chrome
      href={whatsappLink(genericMessage, settings.whatsappNumber)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Falar com a Dom Guima no WhatsApp ${settings.whatsappDisplay || whatsapp.display}`}
      className="group fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 transition-transform duration-200 hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden>
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.38-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
        <path
          fillRule="evenodd"
          d="M12.04 2C6.6 2 2.18 6.42 2.18 11.86c0 1.74.46 3.44 1.32 4.94L2.1 22l5.34-1.4a9.82 9.82 0 0 0 4.6 1.17h.01c5.43 0 9.85-4.42 9.85-9.86 0-2.63-1.02-5.11-2.88-6.97A9.79 9.79 0 0 0 12.04 2Zm0 18.03h-.01a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.16 8.16 0 0 1-1.25-4.36c0-4.52 3.68-8.2 8.2-8.2 2.19 0 4.25.86 5.8 2.41a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.19-8.2 8.19Z"
          clipRule="evenodd"
        />
      </svg>
      <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 lg:block">
        Fale com a gente
      </span>
    </a>
  );
}
