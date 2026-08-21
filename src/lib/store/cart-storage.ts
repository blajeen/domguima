import type { CartItem } from "./cart-types";

/**
 * Store externo do carrinho, por cima do localStorage.
 *
 * Fica fora do React de propósito: o localStorage é um sistema externo, e o
 * jeito certo de ler isso no React 19 é `useSyncExternalStore`. Assim não
 * precisamos de efeito para hidratar, não há setState em efeito e não há
 * descompasso entre o HTML do servidor e o primeiro render do cliente.
 *
 * Brinde: escutamos o evento `storage`, então adicionar um item numa aba
 * atualiza o carrinho nas outras abas abertas.
 */

const STORAGE_KEY = "domguima:cart:v1";

/** Referência estável: o snapshot do servidor precisa ser sempre o mesmo objeto. */
const EMPTY: CartItem[] = [];

let items: CartItem[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const i = value as Record<string, unknown>;
  return (
    typeof i.productId === "string" &&
    typeof i.slug === "string" &&
    typeof i.name === "string" &&
    typeof i.price === "number" &&
    typeof i.quantity === "number" &&
    i.quantity > 0
  );
}

function read(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const valid = parsed.filter(isCartItem);
    return valid.length > 0 ? valid : EMPTY;
  } catch {
    // Modo privado, cota cheia ou JSON corrompido: começa com carrinho vazio.
    return EMPTY;
  }
}

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  items = read();
}

function onStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return;
  items = read();
  emit();
}

export function subscribe(listener: () => void): () => void {
  // O primeiro assinante dispara a leitura — já do lado do cliente.
  const first = listeners.size === 0;
  listeners.add(listener);

  if (first) {
    window.addEventListener("storage", onStorage);
  }
  if (!hydrated) {
    hydrate();
    // Avisa neste tick para quem já estava montado receber os itens salvos.
    queueMicrotask(emit);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function getSnapshot(): CartItem[] {
  return items;
}

/** No servidor o carrinho é sempre vazio — o dado mora no navegador. */
export function getServerSnapshot(): CartItem[] {
  return EMPTY;
}

export function subscribeReady(listener: () => void): () => void {
  return subscribe(listener);
}

export function getReadySnapshot(): boolean {
  return hydrated;
}

export function getReadyServerSnapshot(): boolean {
  return false;
}

/** Única porta de escrita: atualiza memória, disco e assinantes. */
export function setItems(next: CartItem[]): void {
  items = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sem persistência disponível, o carrinho ainda funciona na sessão atual.
  }
  emit();
}
