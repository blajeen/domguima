import "server-only";

/**
 * INSTAGRAM.
 *
 * Buscar posts exige a Instagram Graph API com token de acesso da conta —
 * o perfil público é fechado para leitura automatizada. Sem token,
 * `getInstagramPosts()` devolve lista vazia e a seção mostra o convite para
 * seguir, em vez de fingir posts que não existem.
 *
 * Para ligar:
 *   INSTAGRAM_ACCESS_TOKEN=...   (token de longa duração da conta business)
 *   INSTAGRAM_USER_ID=...        (ID da conta business no Instagram)
 */

export interface InstagramPost {
  id: string;
  imageUrl: string;
  permalink: string;
  caption?: string;
}

interface GraphResponse {
  data?: {
    id: string;
    media_type?: string;
    media_url?: string;
    thumbnail_url?: string;
    permalink?: string;
    caption?: string;
  }[];
}

export function isInstagramConfigured(): boolean {
  return Boolean(
    process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID,
  );
}

export async function getInstagramPosts(limit = 6): Promise<InstagramPost[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!token || !userId) return [];

  const fields = "id,media_type,media_url,thumbnail_url,permalink,caption";

  try {
    const res = await fetch(
      `https://graph.instagram.com/${userId}/media?fields=${fields}&limit=${limit}&access_token=${token}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) {
      console.error(`[instagram] Graph API respondeu ${res.status}.`);
      return [];
    }

    const json = (await res.json()) as GraphResponse;
    return (json.data ?? [])
      .map((post) => ({
        id: post.id,
        // Vídeo não tem media_url utilizável como imagem: usa a thumbnail.
        imageUrl:
          post.media_type === "VIDEO"
            ? (post.thumbnail_url ?? "")
            : (post.media_url ?? ""),
        permalink: post.permalink ?? "",
        caption: post.caption,
      }))
      .filter((post) => post.imageUrl && post.permalink);
  } catch (error) {
    console.error("[instagram] falha ao buscar posts:", error);
    return [];
  }
}
