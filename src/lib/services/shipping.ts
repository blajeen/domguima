/**
 * FRETE E ENDEREÇO.
 *
 * Duas coisas bem diferentes moram aqui:
 *
 * 1. `lookupCep` — REAL e funcionando. Consulta BrasilAPI e ViaCEP em paralelo,
 *    ambos públicos e sem credencial, para não depender de um único serviço.
 *
 * 2. `quoteShipping` — abstração. Cotação real exige contrato com Correios ou
 *    Melhor Envio, então, sem provedor configurado, devolvemos
 *    `{ configured: false }` e a interface diz "frete a combinar" em vez de
 *    mostrar um valor inventado.
 */

export interface CepAddress {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

interface BrasilApiCepResponse {
  cep?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export function sanitizeCep(cep: string): string {
  return cep.replace(/\D/g, "");
}

export function formatCep(cep: string): string {
  const digits = sanitizeCep(cep).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function isValidCep(cep: string): boolean {
  return sanitizeCep(cep).length === 8;
}

/** Consulta real de CEP. Lança `Error` com mensagem pronta para exibir. */
export async function lookupCep(cep: string): Promise<CepAddress> {
  const digits = sanitizeCep(cep);
  if (digits.length !== 8) throw new Error("Informe um CEP com 8 dígitos.");

  try {
    return await Promise.any([lookupBrasilApi(digits), lookupViaCep(digits)]);
  } catch {
    throw new Error(
      "Não conseguimos consultar o CEP agora. Você pode preencher o endereço manualmente.",
    );
  }
}

async function lookupViaCep(digits: string): Promise<CepAddress> {
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) throw new Error("ViaCEP indisponível.");

  const data = (await res.json()) as ViaCepResponse;
  if (data.erro || !data.localidade || !data.uf) throw new Error("CEP não encontrado.");

  return {
    cep: formatCep(digits),
    street: data.logradouro ?? "",
    neighborhood: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
  };
}

async function lookupBrasilApi(digits: string): Promise<CepAddress> {
  const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`, {
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) throw new Error("BrasilAPI indisponível.");

  const data = (await res.json()) as BrasilApiCepResponse;
  if (!data.city || !data.state) throw new Error("CEP não encontrado.");

  return {
    cep: formatCep(digits),
    street: data.street ?? "",
    neighborhood: data.neighborhood ?? "",
    city: data.city,
    state: data.state,
  };
}

export interface ShippingOption {
  id: string;
  label: string;
  /** centavos */
  price: number;
  /** dias úteis */
  deliveryDays: number;
}

export type ShippingQuote =
  | { configured: true; options: ShippingOption[] }
  | { configured: false; reason: string };

export interface QuoteInput {
  cep: string;
  /** gramas */
  totalWeight: number;
  /** centavos */
  subtotal: number;
}

export interface ShippingProvider {
  readonly name: string;
  quote(input: QuoteInput): Promise<ShippingOption[]>;
}

function getShippingProvider(): ShippingProvider | null {
  // Implemente aqui (Correios / Melhor Envio) e devolva o provider.
  return null;
}

export async function quoteShipping(input: QuoteInput): Promise<ShippingQuote> {
  const provider = getShippingProvider();
  if (!provider) {
    return {
      configured: false,
      reason:
        "O cálculo automático de frete ainda não está ativo. Confirmamos o valor com você antes de fechar o pedido.",
    };
  }
  return { configured: true, options: await provider.quote(input) };
}

export function isShippingConfigured(): boolean {
  return getShippingProvider() !== null;
}

export const BRAZILIAN_STATES = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS",
  "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC",
  "SE", "SP", "TO",
] as const;
