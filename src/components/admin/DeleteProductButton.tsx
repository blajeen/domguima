"use client";

import { deleteProductAction } from "@/app/painel/actions";

/**
 * Exclusao definitiva de produto, com confirmacao antes de enviar.
 *
 * Exclusao aqui e irreversivel de verdade — fotos saem do Storage junto — e
 * fica ao lado de "Arquivar" na mesma linha da lista. Sem a confirmacao, um
 * clique errado a dois pixels de distancia apagaria o cadastro.
 *
 * Quem tem historico de estoque nao chega a ser apagado: o servidor recusa e
 * devolve a mensagem explicando que o caminho e arquivar.
 */
export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteProductAction}
      onSubmit={(event) => {
        const certeza = window.confirm(
          `Excluir “${name}” em definitivo?\n\nAs fotos também são apagadas e não há como desfazer.\n\nSe o produto já teve venda ou entrada de estoque, prefira Arquivar — assim o histórico continua.`,
        );
        if (!certeza) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-xs font-bold text-red-700 underline">Excluir</button>
    </form>
  );
}
