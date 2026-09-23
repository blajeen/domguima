/**
 * Campo de formulário da loja (input, select e textarea), igual no checkout e
 * no pedido rápido.
 *
 * - Borda ink-400, e não o fio: sem fundo próprio, a borda é o que mostra onde
 *   o campo está. O fio fica em 1,4:1 no branco e ink-400 em 4,1:1 (o AA pede
 *   3:1 para contorno de controle).
 * - Texto de 16 px: abaixo disso o Safari do iPhone amplia a página ao focar.
 * - Foco: borda grafite mais o anel ouro global de `:focus-visible` (por isso
 *   não há `outline-none`).
 * - Erro: `aria-invalid` no próprio campo deixa a borda vermelha, a mesma cor
 *   da mensagem de erro (4,8:1).
 * - Placeholder em ink-500 (7,6:1): é texto e precisa de 4,5:1.
 */
export const campoStyles =
  "block min-h-11 w-full rounded-control border border-ink-400 bg-white px-3.5 py-2.5 text-base text-grafite-900 transition-colors duration-(--duracao-toque) placeholder:text-ink-500 hover:border-grafite-700 focus:border-grafite-900 aria-invalid:border-promo";
