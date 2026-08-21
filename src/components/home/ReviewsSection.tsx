import { Rating } from "@/components/ui/Rating";
import { googleStats, shopeeStats, social } from "@/config/site";
import { loadPublicStoreSettings } from "@/lib/catalog/database";

/**
 * Prova social sem API. Os números são um retrato público datado e cada canal
 * leva ao perfil oficial para que o visitante possa conferir tudo na origem.
 */
export async function ReviewsSection() {
  const settings = await loadPublicStoreSettings();
  const googleRating = Number(settings.googleRating.replace(",", ".")) || googleStats.ratingAverage;
  const googleCount = Number(settings.googleRatingCount) || googleStats.ratingCount;
  return (
    <section
      aria-labelledby="reputacao-titulo"
      className="border-b border-ink-100 bg-white"
    >
      <div className="site-shell grid gap-4 py-5 lg:grid-cols-[minmax(240px,.8fr)_1fr_1fr] lg:items-stretch">
        <div className="flex flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold-700">
            Compra com confiança
          </p>
          <h2
            id="reputacao-titulo"
            className="mt-1 text-xl font-extrabold tracking-tight text-ink-900"
          >
            Reputação que você pode conferir
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-500">
            Veja os dados públicos diretamente nos canais oficiais da loja.
          </p>
        </div>

        <ReputationCard
          href={settings.googleUrl || googleStats.profileUrl}
          brand="Google"
          icon={<GoogleMark />}
          rating={googleRating}
          count={googleCount}
          verifiedAt={settings.googleVerifiedAt || googleStats.verifiedAt}
          accent="group-hover:border-[#4285F4]/50"
        />

        <ReputationCard
          href={settings.shopeeUrl || social.shopee}
          brand="Shopee"
          icon={<ShopeeMark />}
          rating={shopeeStats.ratingAverage}
          count={shopeeStats.ratingCount}
          verifiedAt={shopeeStats.verifiedAt}
          accent="group-hover:border-[#EE4D2D]/50"
        />
      </div>
    </section>
  );
}

function ReputationCard({
  href,
  brand,
  icon,
  rating,
  count,
  verifiedAt,
  accent,
}: {
  href: string;
  brand: string;
  icon: React.ReactNode;
  rating: number;
  count: number;
  verifiedAt: string;
  accent: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Conferir ${count.toLocaleString("pt-BR")} avaliações da Dom Guima no ${brand}`}
      className={`group flex items-center gap-4 rounded-card border border-ink-100 bg-ink-50/55 px-4 py-4 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-card ${accent}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <strong className="text-2xl font-extrabold tracking-tight text-ink-900">
            {rating.toLocaleString("pt-BR", {
              minimumFractionDigits: brand === "Google" ? 1 : 2,
            })}
          </strong>
          <Rating value={rating} showCount={false} />
        </span>
        <span className="mt-0.5 block text-sm font-semibold text-ink-700">
          {count.toLocaleString("pt-BR")} avaliações no {brand}
        </span>
        <span className="mt-1 block text-[10px] text-ink-400">
          Consulta pública em {formatDate(verifiedAt)}
        </span>
      </span>
      <span
        className="shrink-0 text-lg text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gold-700"
        aria-hidden
      >
        →
      </span>
    </a>
  );
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.5 5.5 0 0 1-2.4 3.62v3h3.86c2.26-2.08 3.57-5.15 3.57-8.86Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.28a12 12 0 0 0 0 10.76l3.99-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

function ShopeeMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
      <path fill="#EE4D2D" d="M6.2 7.2h11.6l.9 13.1a1.6 1.6 0 0 1-1.6 1.7H6.9a1.6 1.6 0 0 1-1.6-1.7l.9-13.1Z" />
      <path fill="none" stroke="#EE4D2D" strokeWidth="1.8" strokeLinecap="round" d="M8.7 8V5.4a3.3 3.3 0 0 1 6.6 0V8" />
      <path fill="#fff" d="M14.7 11.3a5.6 5.6 0 0 0-2.5-.6c-1.5 0-2.5.7-2.5 1.8 0 2.8 5.4 1.4 5.4 5 0 1.8-1.5 3-3.8 3-1.2 0-2.4-.3-3.2-.8l.6-1.5c.8.4 1.8.7 2.7.7 1.2 0 1.9-.5 1.9-1.3 0-2.1-5.4-1-5.4-4.9 0-2 1.7-3.4 4.3-3.4 1.1 0 2.2.2 3.1.7l-.6 1.3Z" />
    </svg>
  );
}
