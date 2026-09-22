import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { readAttendantsState } from "@/lib/admin/catalog-store";
import { defaultStoreSettings } from "@/lib/admin/defaults";
import { contactableAttendants, distributionCandidates, eligibleAttendants, resolveAttendantNumber } from "@/lib/admin/distribution";
import { createLead, normalizeAttribution } from "@/lib/admin/leads";
import { canonicalSellerId, defaultSellers, normalizeLeadDistributionMode } from "@/lib/admin/sellers";
import type { LeadDistributionMode, SellerRecord, StoreSettings } from "@/lib/admin/types";
import { genericMessage, whatsappLink } from "@/lib/services/whatsapp";

/**
 * ABRIR O WHATSAPP REGISTRANDO O ATENDIMENTO
 * ==========================================
 *
 * Todos os botoes de WhatsApp do site passam por aqui em vez de apontarem
 * direto para o wa.me. A rota decide quem atende (escolha do cliente, rodizio
 * ou menos ocupado), grava o atendimento e so entao redireciona.
 *
 * REGRA INEGOCIAVEL: o cliente sempre chega ao WhatsApp. Catalogo fora do ar,
 * tabela de atendimentos ainda nao criada, parametro adulterado, limite de
 * requisicoes — nada disso pode devolver erro. Cada falha derruba o CRM
 * daquele clique e mantem o redirect.
 *
 * O destino e SEMPRE um link wa.me montado por `whatsappLink` a partir de
 * digitos vindos do cadastro de atendentes: nenhum parametro da URL vira
 * destino, senao a rota seria um redirecionador aberto.
 *
 * Nao usa `after()`: a escolha do atendente decide o numero do redirect, entao
 * ela tem de acontecer ANTES da resposta.
 *
 * GET e POST fazem a mesma coisa e mudam so de onde vem os campos: os links do
 * site usam o GET; o pedido rapido usa o POST, para o nome e o bairro do
 * cliente nao viajarem na URL.
 */

/** Visitante anonimo. So serve para o dedupe de 90s e para juntar os contatos da mesma pessoa. */
const VISITANTE_COOKIE = "domguima_visitante";
const VISITANTE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Origem gravada no navegador (UTM, referrer, campanha).
 *
 * Quem escreve este cookie e a captura de origem do site, que entra junto com o
 * controle de trafego. Enquanto ela nao existir o cookie simplesmente nao esta
 * la e `attribution` fica vazio — ler aqui desde ja evita ter de mexer na rota
 * (e nas RPCs) depois.
 */
const ORIGEM_COOKIE = "domguima_origem";

const atendimentoInput = z.object({
  /** Id do atendente escolhido no dialogo, ou "auto" quando o painel distribui. */
  atendente: z.string().trim().max(60),
  tipo: z.enum(["whatsapp_generic", "whatsapp_product", "whatsapp_cart", "quick_checkout"]),
  produto: z.string().trim().max(200),
  texto: z.string().max(4_000),
  pagina: z.string().trim().max(300),
  cliente: z.string().trim().max(140),
});

type AtendimentoParams = z.infer<typeof atendimentoInput>;

const requestLog = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1_000;
const MAX_REQUESTS = 40;

export async function GET(request: NextRequest) {
  const busca = request.nextUrl.searchParams;
  return abrirWhatsapp(request, lerParametros((chave) => busca.get(chave)), 302);
}

/**
 * A MESMA rota, com os campos no corpo em vez da query string.
 *
 * Quem usa e o pedido rapido (/checkout/rapido): ali o texto carrega nome,
 * bairro e observacao do cliente, e numa URL de GET isso ficaria nos logs de
 * acesso do servidor, no historico do navegador e na barra de endereco da aba
 * nova. No corpo do POST o dado so existe onde a loja realmente precisa dele.
 *
 * O formulario e enviado pelo proprio navegador com `target="_blank"`, entao o
 * 303 abre o WhatsApp na aba nova exatamente como o GET faz. 303 (e nao 302)
 * porque e o status que manda o navegador trocar o POST por um GET no destino.
 */
export async function POST(request: NextRequest) {
  const corpo = await lerCorpo(request);
  const busca = request.nextUrl.searchParams;
  return abrirWhatsapp(request, lerParametros((chave) => corpo.get(chave) ?? busca.get(chave)), 303);
}

async function abrirWhatsapp(request: NextRequest, entrada: AtendimentoParams, status: 302 | 303) {
  // O limite e o referer governam o REGISTRO, nunca o redirect: um robo que
  // varre links nao deve encher a fila de atendimentos, e um cliente que
  // estourou o limite nao pode ficar sem falar com a loja.
  const registrar = daPropriaLoja(request) && !isRateLimited(request);

  // A lista padrao e a mesma de config/site (e a que o dialogo mostra quando o
  // catalogo cai): com ela, "gabriel" continua resolvendo o numero do Gabriel
  // mesmo com o cadastro fora do ar. Zerar a lista aqui mandaria para o numero
  // principal da loja justamente o cliente que escolheu outra pessoa na tela.
  let sellers: SellerRecord[] = defaultSellers();
  let settings: StoreSettings = defaultStoreSettings;
  try {
    const cadastro = await readAttendantsState();
    sellers = cadastro.sellers;
    settings = cadastro.settings;
  } catch (error) {
    console.warn("Cadastro de atendentes indisponivel ao abrir o WhatsApp; usando a lista padrao do site.", error);
  }

  const modo = normalizeLeadDistributionMode(settings.leadDistributionMode);
  const elegiveis = eligibleAttendants(sellers, settings);
  // A lista que o dialogo mostrou e a unica que pode resolver quem o cliente
  // escolheu. Quem marcou "recebe atendimentos" (elegiveis) continua sendo o
  // que vai ao sorteio automatico.
  const contactaveis = contactableAttendants(sellers, settings);
  const escolhidoPeloCliente = acharAtendente(contactaveis, entrada.atendente);
  // So deixamos a RPC escolher quando ha de fato o que sortear. Fora disso o
  // atendente e resolvido aqui, para o atendimento gravado apontar exatamente
  // para o WhatsApp que abriu na tela do cliente.
  const automatico = !escolhidoPeloCliente && (modo === "round_robin" || modo === "least_busy") && elegiveis.length > 0;
  const preDefinido = escolhidoPeloCliente ?? (automatico ? null : contactaveis[0] ?? null);

  const visitante = request.cookies.get(VISITANTE_COOKIE)?.value ?? "";
  const novoVisitante = visitante || randomUUID();

  const atribuido = registrar
    ? await registrarAtendimento({
        entrada,
        escolhidoPeloCliente,
        preDefinido,
        automatico,
        modo,
        elegiveis,
        visitante: novoVisitante,
        attribution: lerOrigem(request.cookies.get(ORIGEM_COOKIE)?.value),
        sellers,
      })
    : null;

  const atendente = preDefinido ?? atribuido ?? elegiveis[0] ?? null;
  const numero = resolveAttendantNumber({ whatsapp_number: atendente?.whatsapp_number ?? null }, settings);
  const destino = whatsappLink(entrada.texto || genericMessage, numero);

  const response = NextResponse.redirect(destino, status);
  if (!visitante) {
    response.cookies.set(VISITANTE_COOKIE, novoVisitante, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: VISITANTE_MAX_AGE,
    });
  }
  return response;
}

interface RegistroInput {
  entrada: AtendimentoParams;
  escolhidoPeloCliente: SellerRecord | null;
  preDefinido: SellerRecord | null;
  automatico: boolean;
  modo: LeadDistributionMode;
  elegiveis: SellerRecord[];
  visitante: string;
  attribution: Record<string, string>;
  sellers: SellerRecord[];
}

/** Grava o atendimento e devolve quem a distribuicao automatica escolheu (ou null). */
async function registrarAtendimento(input: RegistroInput): Promise<SellerRecord | null> {
  const { entrada, escolhidoPeloCliente, preDefinido, automatico, modo, elegiveis, visitante, attribution, sellers } = input;
  try {
    const { lead } = await createLead(
      {
        kind: entrada.tipo,
        sellerId: preDefinido?.id ?? null,
        // "customer" quando o proprio cliente apontou no dialogo; "site" quando
        // o botao era unico e a loja so tinha um destino possivel.
        assignedBy: preDefinido ? (escolhidoPeloCliente ? "customer" : "site") : null,
        customerName: entrada.cliente,
        productId: entrada.produto || null,
        message: entrada.texto,
        pagePath: entrada.pagina,
        // A classificacao da origem (Instagram, Google, campanha) entra com o
        // controle de trafego; ate la todo atendimento nasce como "direto" e o
        // que houver no cookie ja viaja em `attribution`.
        source: "direct",
        attribution,
        visitorId: visitante,
        createdBy: "public-site",
      },
      {
        candidates: automatico ? distributionCandidates(elegiveis) : [],
        mode: automatico ? modo : "customer_choice",
      },
    );
    if (!lead?.seller_id) return null;
    return sellers.find((seller) => seller.id === lead.seller_id) ?? null;
  } catch (error) {
    console.warn("Nao foi possivel registrar o atendimento; o WhatsApp abre mesmo assim.", error);
    return null;
  }
}

/**
 * Le os campos sem nunca falhar: parametro grande e cortado, tipo desconhecido
 * vira contato generico. Uma URL estranha nao pode custar a conversa.
 *
 * `ler` e a fonte dos campos — a query string no GET, o corpo no POST — para a
 * validacao e os tetos de tamanho existirem uma vez so.
 */
function lerParametros(ler: (chave: string) => string | null | undefined): AtendimentoParams {
  const campo = (chave: string, tamanho: number) => (ler(chave) ?? "").slice(0, tamanho);
  const bruto = {
    atendente: campo("atendente", 60),
    tipo: ler("tipo") || "whatsapp_generic",
    produto: campo("produto", 200),
    texto: campo("texto", 4_000),
    pagina: campo("pagina", 300),
    cliente: campo("cliente", 140),
  };
  const parsed = atendimentoInput.safeParse(bruto);
  return parsed.success ? parsed.data : { ...bruto, tipo: "whatsapp_generic" };
}

/**
 * Campos do corpo do POST. Corpo ausente, vazio ou em outro formato devolve um
 * mapa vazio: a rota segue com o que houver na query e o cliente chega ao
 * WhatsApp de qualquer jeito.
 */
async function lerCorpo(request: NextRequest): Promise<Map<string, string>> {
  const campos = new Map<string, string>();
  try {
    for (const [chave, valor] of await request.formData()) {
      if (typeof valor === "string") campos.set(chave, valor);
    }
  } catch (error) {
    console.warn("Nao foi possivel ler o formulario do atendimento; seguindo com a query.", error);
  }
  return campos;
}

/**
 * Atendente escolhido no dialogo.
 *
 * A busca e na lista de ELEGIVEIS, nao no cadastro inteiro: quem esta com
 * "recebe atendimentos" desligado (viagem, folga) nao pode voltar a receber so
 * porque o cliente tem em cache uma pagina antiga com o id dele — ou um link
 * salvo. Nesse caso o cliente cai na distribuicao normal, em vez de mandar
 * mensagem para um WhatsApp que ninguem vai abrir.
 */
function acharAtendente(elegiveis: readonly SellerRecord[], id: string): SellerRecord | null {
  const procurado = canonicalSellerId(id.trim().toLowerCase());
  if (!procurado || procurado === "auto") return null;
  return elegiveis.find((seller) => seller.id === procurado) ?? null;
}

function lerOrigem(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  for (const texto of [decodificar(raw), raw]) {
    try {
      return normalizeAttribution(JSON.parse(texto));
    } catch {
      // Cookie adulterado ou em outro formato: seguimos sem origem.
    }
  }
  return {};
}

function decodificar(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * O clique saiu de uma pagina nossa?
 *
 * Quem decide e o `Sec-Fetch-Site`: ele e preenchido pelo proprio navegador e,
 * ao contrario do `Referer`, nao pode ser suprimido pela pagina de origem.
 * Isso importa porque os nossos links usam `rel="noreferrer"` — sem este
 * cabecalho a checagem de referer nunca dispararia, e qualquer site de
 * terceiros poderia encher a fila de atendimentos com um `<img>` apontando
 * para ca.
 *
 * Cabecalho ausente (webview antiga, navegador velho) continua registrando:
 * perder atendimento real e pior do que aceitar algum ruido. O referer segue
 * como segunda camada para quem manda os dois.
 */
function daPropriaLoja(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") return false;

  const referer = request.headers.get("referer");
  if (!referer) return true;
  try {
    const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
    return Boolean(host && new URL(referer).host === host);
  } catch {
    return false;
  }
}

/**
 * Limite por IP, no mesmo desenho de /api/pedidos.
 *
 * Limite conhecido: o contador vive na memoria da instancia; em serverless com
 * varias instancias o teto efetivo e maior. Serve para conter varredura, nao
 * como protecao forte.
 */
function isRateLimited(request: NextRequest): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const current = requestLog.get(ip);
  if (!current || current.resetAt <= now) {
    requestLog.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS;
}
