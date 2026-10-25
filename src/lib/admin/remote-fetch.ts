import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Baixa um arquivo PUBLICO da internet (pagina do fabricante, foto do
 * produto) a partir de um endereco que veio da pesquisa, nao do lojista.
 *
 * Sem estas travas o painel viraria um proxy para a rede interna da
 * hospedagem (169.254.169.254, localhost): so http(s), so IP publico, poucos
 * redirecionamentos (cada um conferido de novo), prazo e tamanho maximos.
 * shortcut: o IP e conferido antes do fetch e o fetch resolve o DNS de novo (rebinding em tese passa); aceitavel porque so a conta do painel chama isto. Fixar o IP no agente HTTP se a rota abrir para mais gente.
 */
export class RemoteFetchError extends Error {}

export interface RemoteFile {
  buffer: Buffer;
  contentType: string;
  finalUrl: string;
}

const MAX_REDIRECTS = 4;

export async function fetchPublic(rawUrl: string, { maxBytes, timeoutMs = 12_000, accept }: { maxBytes: number; timeoutMs?: number; accept: (contentType: string) => boolean }): Promise<RemoteFile> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let url = await assertPublicUrl(rawUrl);
    for (let salto = 0; salto <= MAX_REDIRECTS; salto += 1) {
      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        // Cabecalhos de navegador comum: varias lojas recusam robo declarado.
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", Accept: "text/html,application/xhtml+xml,image/avif,image/webp,image/*,*/*;q=0.8", "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" },
      });
      if (response.status >= 300 && response.status < 400) {
        const destino = response.headers.get("location");
        if (!destino) throw new RemoteFetchError("Redirecionamento sem destino.");
        url = await assertPublicUrl(new URL(destino, url).toString());
        continue;
      }
      if (!response.ok || !response.body) throw new RemoteFetchError(`Resposta ${response.status}.`);
      const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!accept(contentType)) throw new RemoteFetchError(`Tipo não aceito: ${contentType || "desconhecido"}.`);
      if (Number(response.headers.get("content-length") ?? 0) > maxBytes) throw new RemoteFetchError("Arquivo grande demais.");
      const partes: Uint8Array[] = [];
      let total = 0;
      const leitor = response.body.getReader();
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) { await leitor.cancel(); throw new RemoteFetchError("Arquivo grande demais."); }
        partes.push(value);
      }
      return { buffer: Buffer.concat(partes), contentType, finalUrl: url.toString() };
    }
    throw new RemoteFetchError("Redirecionamentos demais.");
  } catch (error) {
    if (error instanceof RemoteFetchError) throw error;
    throw new RemoteFetchError(error instanceof Error && error.name === "AbortError" ? "Demorou demais." : "Não foi possível baixar.");
  } finally {
    clearTimeout(timer);
  }
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new RemoteFetchError("Endereço inválido."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new RemoteFetchError("Só http(s).");
  if (url.username || url.password) throw new RemoteFetchError("Endereço com usuário não é aceito.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const enderecos = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((item) => item.address);
  if (!enderecos.length || enderecos.some(isPrivateAddress)) throw new RemoteFetchError("Endereço não público.");
  return url;
}

/** Rede interna, loopback, link-local, CGNAT, multicast e afins. */
export function isPrivateAddress(ip: string): boolean {
  const mapeado = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeado) return isPrivateAddress(mapeado[1]);
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19));
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff");
}
