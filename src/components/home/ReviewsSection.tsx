import { Rating } from "@/components/ui/Rating";
import { reputacaoDaLoja } from "@/lib/catalog/reputacao";
import { formatDate } from "@/lib/utils/format";

/**
 * Prova social sem API. Os números são um retrato público datado e cada canal
 * leva ao perfil oficial para que o visitante possa conferir tudo na origem.
 */
export async function ReviewsSection() {
  // Mesma leitura da página de produto (painel primeiro, config/site depois).
  const { google, shopee } = await reputacaoDaLoja();
  return (
    <section
      aria-labelledby="reputacao-titulo"
      className="border-b border-ink-100 bg-white"
    >
      <div className="site-shell grid gap-4 py-5 lg:grid-cols-[minmax(240px,.8fr)_1fr_1fr] lg:items-stretch">
        {/* Só o título: sem rótulo em caixa alta acima nem subtítulo. Que os
            dados são públicos, cada card já diz (data da consulta e link). */}
        <div className="flex flex-col justify-center">
          <h2
            id="reputacao-titulo"
            className="text-balance text-titulo font-bold text-grafite-900"
          >
            Avaliações da loja
          </h2>
        </div>

        <ReputationCard
          href={google.href}
          brand="Google"
          icon={<GoogleMark />}
          rating={google.nota}
          count={google.avaliacoes}
          verifiedAt={google.consultadoEm}
          accent="group-hover:border-[#4285F4]/50"
        />

        <ReputationCard
          href={shopee.href}
          brand="Shopee"
          icon={<ShopeeMark />}
          rating={shopee.nota}
          count={shopee.avaliacoes}
          verifiedAt={shopee.consultadoEm}
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
      className={`group flex items-center gap-4 rounded-card border border-ink-100 bg-ink-50/55 px-4 py-4 transition-[background-color,border-color] duration-150 hover:bg-white ${accent}`}
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
        <span className="mt-1 block text-xs text-ink-500">
          Consulta pública em {formatDate(verifiedAt)}
        </span>
      </span>
    </a>
  );
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
