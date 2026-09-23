import Image from "next/image";
import { buttonStyles } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
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
        id="instagram-titulo"
        title="Siga a Dom Guima"
        href={social.instagram}
        linkLabel="Abrir perfil"
      />

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
                className="object-cover"
              />
              <span className="absolute inset-0 bg-ink-950/0 transition-colors group-hover:bg-ink-950/25" />
            </a>
          ))}
        </div>
      ) : (
        // Grafite chapado, sem gradiente nem sombra: é um bloco da página, não
        // algo que flutua.
        <div className="overflow-hidden rounded-card bg-grafite-950">
          <div className="flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:p-7 sm:text-left">
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
              <p className="mt-3 text-sm text-ink-300">
                <strong className="font-bold text-ouro-claro">
                  {instagramStats.followers.toLocaleString("pt-BR")}
                </strong>{" "}
                seguidores
              </p>
            </div>

            <a
              href={social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles({ variant: "claro", size: "lg", className: "shrink-0" })}
            >
              <Icon name="instagram" />
              Seguir no Instagram
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
