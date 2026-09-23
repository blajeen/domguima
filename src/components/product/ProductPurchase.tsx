"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WhatsAppChooser } from "@/components/layout/WhatsAppChooser";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PriceTag } from "@/components/ui/PriceTag";
import { linhasDoPreco } from "@/lib/catalog/apresentacao";
import type { Product } from "@/lib/catalog/types";
import { productMessage } from "@/lib/services/whatsapp";
import { useAttendants } from "@/lib/store/attendants";
import { useCart } from "@/lib/store/cart";
import { formatPrice } from "@/lib/utils/format";
import { CONFIRMACAO_MS } from "./AddToCartButton";
import { BarraCompraFixa } from "./BarraCompraFixa";
import { TabelaDeParcelas } from "./TabelaDeParcelas";
import { useVariantImage } from "./VariantImageContext";

/**
 * Bloco de compra: preço, variação, quantidade e um caminho principal. Antes
 * eram três botões do mesmo peso; agora "Comprar agora" (grafite) manda, o
 * carrinho vem em contorno e o WhatsApp vira o contato com quem atende, com o
 * nome dessas pessoas quando o cliente escolhe com quem fala. No celular, a
 * barra fixa repete preço e botão quando
 * este bloco sai da tela.
 */
export function ProductPurchase({
  product,
  productUrl,
}: {
  product: Product;
  productUrl: string;
}) {
  const router = useRouter();
  const { addItem, openCart } = useCart();
  const { contacts, mode } = useAttendants();
  const { escolher: mostrarFotoDaVariacao } = useVariantImage();
  const acoesRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Opcoes com estoque proprio tem prioridade sobre o rotulo antigo, que
  // continua servindo para produto sem variacao de verdade.
  const opcoes = product.variantOptions ?? [];
  const temOpcoes = opcoes.length > 0;
  const variantGroup = temOpcoes ? undefined : product.variants?.[0];

  const [variantId, setVariantId] = useState<string | undefined>(
    // Comeca na primeira opcao COM estoque: abrir numa cor esgotada faria o
    // cliente ver "indisponivel" num produto que tem outras cores disponiveis.
    opcoes.find((item) => item.stock > 0)?.id ?? opcoes[0]?.id,
  );
  const [variant, setVariant] = useState<string | undefined>(
    variantGroup?.options[0],
  );
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  // Conta as adições para o aviso do leitor de tela ganhar um nó novo a cada
  // clique (mesma solução do AddToCartButton).
  const [adicoes, setAdicoes] = useState(0);

  const opcao = opcoes.find((item) => item.id === variantId);
  const preco = opcao ? opcao.price : product.price;
  const estoque = opcao ? opcao.stock : product.stock;
  const outOfStock = estoque <= 0;
  const linhas = linhasDoPreco(product, opcao);
  // O preço "de" é do preço-base do produto (o mesmo que o card mostra com o
  // −X%). Vale para a opção com esse preço; opção com preço próprio fica sem
  // desconto. O parcelado não tem essa regra: é calculado sobre cada preço.
  const precoAnterior = !opcao || opcao.price === product.price ? product.oldPrice : undefined;

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function add() {
    if (outOfStock) return;
    addItem(product, quantity, variant, variantId);
    setAdded(true);
    setAdicoes((n) => n + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), CONFIRMACAO_MS);
  }

  function buyNow() {
    if (outOfStock) return;
    addItem(product, quantity, variant, variantId);
    router.push("/checkout");
  }

  return (
    <div className="space-y-5">
      <div>
        <PriceTag
          size="produto"
          cents={preco}
          oldCents={precoAnterior}
          lines={linhas}
        />
        <Disponibilidade estoque={estoque} />
        {/* Sobre o preço da opção marcada: trocar a cor mais cara refaz as parcelas. */}
        <TabelaDeParcelas cents={preco} className="mt-3" />
      </div>

      {/* Fio dourado: a assinatura que separa o preço da decisão de compra. */}
      <div aria-hidden className="h-px bg-ouro" />

      {/* Variação com estoque próprio */}
      {temOpcoes && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-grafite-900">
            {product.variantAxis ?? "Variação"}:{" "}
            <span className="font-normal text-ink-600">{opcao?.label}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {opcoes.map((item) => {
              const esgotada = item.stock <= 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setVariantId(item.id);
                    setQuantity(1);
                    // Sem foto própria, a galeria volta para a capa.
                    mostrarFotoDaVariacao(item.image ?? null);
                  }}
                  aria-pressed={item.id === variantId}
                  className={`${opcaoBase} ${
                    item.id === variantId
                      ? opcaoMarcada
                      : esgotada
                        ? "border-fio text-ink-500 hover:border-grafite-700"
                        : opcaoLivre
                  }`}
                >
                  {item.label}
                  <span className="mt-0.5 block text-xs font-normal tabular-nums text-ink-600">
                    {esgotada ? "Sem estoque" : formatPrice(item.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Variação apenas informativa (produto sem estoque por opção) */}
      {variantGroup && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-grafite-900">
            {variantGroup.name}:{" "}
            <span className="font-normal text-ink-600">{variant}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {variantGroup.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setVariant(option)}
                aria-pressed={variant === option}
                className={`${opcaoBase} ${variant === option ? opcaoMarcada : opcaoLivre}`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* Quantidade */}
      {!outOfStock && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span id="rotulo-quantidade" className="text-sm font-semibold text-grafite-900">
            Quantidade
          </span>
          <div
            role="group"
            aria-labelledby="rotulo-quantidade"
            className="flex items-center rounded-control border border-fio bg-white"
          >
            <BotaoQuantidade
              icon="menos"
              label="Diminuir quantidade"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            />
            <span className="min-w-10 text-center text-base font-semibold tabular-nums text-grafite-900">
              {quantity}
            </span>
            <BotaoQuantidade
              icon="mais"
              label="Aumentar quantidade"
              disabled={quantity >= estoque}
              onClick={() => setQuantity((q) => Math.min(estoque, q + 1))}
            />
          </div>
          <span className="text-xs tabular-nums text-ink-500">
            {estoque} {estoque === 1 ? "disponível" : "disponíveis"}
          </span>
        </div>
      )}

      {/* Ações: um principal e, abaixo, o carrinho em contorno. */}
      <div ref={acoesRef} className="space-y-2.5">
        <Button onClick={buyNow} disabled={outOfStock} size="lg" fullWidth>
          {outOfStock ? "Indisponível" : "Comprar agora"}
        </Button>

        {!outOfStock && (
          <Button
            variant="secundario"
            size="lg"
            fullWidth
            onClick={added ? openCart : add}
          >
            {added ? (
              <>
                <Icon name="check" className="text-ouro" />
                No carrinho
                <span className="sr-only">: abrir o carrinho</span>
              </>
            ) : (
              "Adicionar ao carrinho"
            )}
          </Button>
        )}
        <span role="status" className="sr-only">
          {added && <span key={adicoes}>{product.name} adicionado ao carrinho</span>}
        </span>
      </div>

      {/* Contato humano: abre o seletor de atendente de sempre, com a mesma
          mensagem e o mesmo registro de atendimento (whatsapp_product). */}
      <WhatsAppChooser
        message={productMessage(product, productUrl)}
        kind="whatsapp_product"
        productId={product.id}
        className="flex min-h-14 w-full items-center gap-3 rounded-control border border-fio bg-white px-3 py-2.5 text-left transition-colors duration-(--duracao-toque) hover:border-grafite-900"
      >
        {/* Grafite sobre o verde: o glifo branco ficaria abaixo de 3:1. Mesma
            marca das linhas da escolha do atendente, que abre daqui. */}
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-control bg-whatsapp text-grafite-900"
        >
          <Icon name="whatsapp" />
        </span>
        <span className="text-sm font-semibold text-grafite-900">
          {chamadaDoContato(
            mode === "customer_choice" ? contacts.map((contact) => contact.name) : [],
          )}
        </span>
      </WhatsAppChooser>

      {!outOfStock && (
        <BarraCompraFixa
          alvo={acoesRef}
          cents={preco}
          // Só a frase curta cabe ao lado do botão: o preço é o à vista, no
          // Pix ou dinheiro, e a barra diz isso.
          lines={{ pix: linhas.pix, cartao: null }}
          rotulo="Comprar agora"
          onComprar={buyNow}
        />
      )}
    </div>
  );
}

const opcaoBase =
  "min-h-11 rounded-control border bg-white px-4 py-2 text-left text-sm font-medium transition-colors duration-(--duracao-toque)";
// Marcada: o fio vira grafite de 2 px (borda + anel por dentro), sem mudar o tamanho.
const opcaoMarcada = "border-grafite-900 font-semibold text-grafite-900 ring-1 ring-inset ring-grafite-900";
const opcaoLivre = "border-fio text-grafite-900 hover:border-grafite-900";

/**
 * "Dúvida? Chama Juliano ou Gabriel no WhatsApp", com os nomes de quem o
 * painel põe para atender (a mesma lista do seletor). Sem artigo antes do
 * nome: a lista pode ganhar gente nova, e "o" nem sempre serve. Em rodízio ou
 * "menos ocupado" o diálogo não deixa escolher, então vai sem nomes (lista
 * vazia): a frase não promete uma escolha que o fluxo não dá.
 */
function chamadaDoContato(nomes: string[]): string {
  const unicos = [...new Set(nomes.map((nome) => nome.trim()).filter(Boolean))];
  if (unicos.length === 0) return "Dúvida? Fale com a gente no WhatsApp";
  const lista = new Intl.ListFormat("pt-BR", { type: "disjunction" }).format(unicos);
  return `Dúvida? Chama ${lista} no WhatsApp`;
}

/** Estoque real. O vermelho de oferta só aparece quando a urgência é de verdade. */
function Disponibilidade({ estoque }: { estoque: number }) {
  const [icone, texto, cor]: [IconName, string, string] =
    estoque <= 0
      ? ["info", "Produto indisponível no momento", "font-semibold text-grafite-900"]
      : estoque <= 3
        ? [
            "alerta",
            estoque === 1 ? "Última unidade em estoque" : `Últimas ${estoque} unidades em estoque`,
            "font-semibold text-oferta",
          ]
        : ["check", "Disponível em estoque", "text-ink-600"];

  return (
    <p className={`mt-3 flex items-center gap-2 text-sm ${cor}`}>
      <Icon name={icone} size={18} className={estoque > 3 ? "text-ouro" : undefined} />
      {texto}
    </p>
  );
}

function BotaoQuantidade({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-11 items-center justify-center text-grafite-900 transition-colors duration-(--duracao-toque) hover:bg-papel disabled:cursor-not-allowed disabled:text-ink-300 disabled:hover:bg-transparent"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
