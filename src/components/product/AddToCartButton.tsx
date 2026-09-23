"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { type CartProductInput, useCart } from "@/lib/store/cart";

/** Quanto tempo o botão fica em "No carrinho" antes de voltar ao normal. */
const CONFIRMACAO_MS = 1500;

/**
 * A única parte do card de produto que roda no navegador: põe no carrinho e
 * confirma no próprio botão ("No carrinho" com o check) por um instante. O
 * contador do header pulsa junto (CartButton). Recebe só o que o carrinho usa.
 */
export function AddToCartButton({ product }: { product: CartProductInput }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  // Conta as adições para dar um nó novo ao aviso a cada clique (ver abaixo).
  const [adicoes, setAdicoes] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function onAdd() {
    addItem(product, 1);
    setAdded(true);
    setAdicoes((n) => n + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), CONFIRMACAO_MS);
  }

  return (
    <>
      <Button
        size="sm"
        fullWidth
        onClick={onAdd}
        aria-label={
          added ? `${product.name} no carrinho` : `Adicionar ${product.name} ao carrinho`
        }
      >
        {added ? (
          <>
            No carrinho
            <Icon name="check" size={18} className="text-ouro-claro" />
          </>
        ) : (
          "Adicionar"
        )}
      </Button>
      {/* O rótulo do botão muda, mas o leitor de tela não anuncia isso sozinho.
          A `key` troca o nó a cada adição: numa segunda adição antes de o
          botão voltar ao normal, o texto seria o mesmo e a região viva
          ficaria calada, com mais uma unidade entrando no carrinho. */}
      <span role="status" className="sr-only">
        {added && <span key={adicoes}>{product.name} adicionado ao carrinho</span>}
      </span>
    </>
  );
}
