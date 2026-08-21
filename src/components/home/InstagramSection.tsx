import Image from "next/image";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { instagramStats, social } from "@/config/site";
import { getInstagramPosts } from "@/lib/services/instagram";

/**
 * Seção do Instagram. Se a Graph API estiver configurada, mostra os posts
 * reais; senão, mostra o convite para seguir — sem inventar publicação.
 */
export async function InstagramSection() {
  const posts = await getInstagramPosts(6);

  return (
    <section aria-labelledby="instagram-titulo">
      <SectionHeader
        eyebrow="Redes sociais"
        title="Siga a Dom Guima"
        description="Novidades, lançamentos e promoções que saem primeiro por lá."
        href={social.instagram}
        linkLabel="Abrir perfil"
      />
      <h2 id="instagram-titulo" className="sr-only">
        Instagram da Dom Guima
      </h2>

      {posts.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
          {posts.map((post) => (
            <a
              key={post.id}
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-lg bg-ink-100"
            >
              <Image
                src={post.imageUrl}
                alt={post.caption?.slice(0, 120) ?? "Publicação da Dom Guima no Instagram"}
                fill
                sizes="(max-width: 640px) 33vw, 16vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-ink-950/0 transition-colors group-hover:bg-ink-950/25" />
            </a>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-ink-100 bg-gradient-to-br from-ink-900 via-ink-800 to-gold-900 shadow-card">
          <div className="flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:p-7 sm:text-left">
            {/* Placa clara atrás da logo: a arte é escura e sumiria no gradiente. */}
            <div className="shrink-0">
              <Image
                src="/brand/logo-dom-guima.png"
                alt=""
                width={96}
                height={96}
                className="h-[72px] w-[72px] object-contain sm:h-[84px] sm:w-[84px]"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold text-white sm:text-xl">
                {social.instagramHandle}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-300">
                Smart TVs, celulares e eletrodomésticos com preço de promoção.
                É lá que mostramos os produtos que acabaram de chegar.
              </p>
              {/* Dado real: contagem lida do perfil público. */}
              <p className="mt-3 text-sm text-ink-400">
                <strong className="font-bold text-gold-300">
                  {instagramStats.followers.toLocaleString("pt-BR")}
                </strong>{" "}
                seguidores
              </p>
            </div>

            <a
              href={social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-white transition-transform duration-200 hover:scale-[1.03] active:scale-95"
            >
              <InstagramIcon />
              Seguir no Instagram
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
    </svg>
  );
}
