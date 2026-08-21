"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Product } from "@/lib/catalog/types";
import {
  getReadySnapshot,
  getReadyServerSnapshot,
  getServerSnapshot,
  getSnapshot,
  setItems,
  subscribe,
  subscribeReady,
} from "./cart-storage";
import { type CartItem, lineKey } from "./cart-types";

export { lineKey };
export type { CartItem };

interface CartContextValue {
  items: CartItem[];
  /** Vira true depois de ler o localStorage — evita mismatch de hidratação. */
  ready: boolean;
  count: number;
  subtotal: number;
  savings: number;
  total: number;
  totalWeight: number;
  isOpen: boolean;
  /** Id do item recém-adicionado, para o feedback visual do header. */
  lastAdded: string | null;
  addItem: (product: Product, quantity?: number, variant?: string) => void;
  removeItem: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  // localStorage é sistema externo: lemos com a API própria do React para isso.
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(
    subscribeReady,
    getReadySnapshot,
    getReadyServerSnapshot,
  );

  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (addedTimer.current) clearTimeout(addedTimer.current);
    };
  }, []);

  const addItem = useCallback(
    (product: Product, quantity = 1, variant?: string) => {
      if (product.stock <= 0) return;

      const incoming: CartItem = {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.images[0]?.src ?? "",
        price: product.price,
        oldPrice: product.oldPrice,
        quantity,
        stock: product.stock,
        weight: product.shipping.weight,
        variant,
      };

      const key = lineKey(incoming);
      const current = getSnapshot();
      const existing = current.find((i) => lineKey(i) === key);

      setItems(
        existing
          ? current.map((i) =>
              lineKey(i) === key
                ? { ...i, quantity: Math.min(i.quantity + quantity, i.stock) }
                : i,
            )
          : [...current, incoming],
      );

      setLastAdded(product.id);
      if (addedTimer.current) clearTimeout(addedTimer.current);
      addedTimer.current = setTimeout(() => setLastAdded(null), 1600);
    },
    [],
  );

  const removeItem = useCallback((key: string) => {
    setItems(getSnapshot().filter((i) => lineKey(i) !== key));
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    const current = getSnapshot();
    if (quantity <= 0) {
      setItems(current.filter((i) => lineKey(i) !== key));
      return;
    }
    setItems(
      current.map((i) =>
        lineKey(i) === key
          ? { ...i, quantity: Math.min(quantity, i.stock) }
          : i,
      ),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const totals = useMemo(() => {
    let count = 0;
    let subtotal = 0;
    let listTotal = 0;
    let totalWeight = 0;
    for (const i of items) {
      count += i.quantity;
      subtotal += i.price * i.quantity;
      listTotal += (i.oldPrice ?? i.price) * i.quantity;
      totalWeight += i.weight * i.quantity;
    }
    return { count, subtotal, savings: listTotal - subtotal, totalWeight };
  }, [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      ready,
      isOpen,
      lastAdded,
      ...totals,
      total: totals.subtotal,
      addItem,
      removeItem,
      setQuantity,
      clear,
      openCart,
      closeCart,
    }),
    [
      items,
      ready,
      isOpen,
      lastAdded,
      totals,
      addItem,
      removeItem,
      setQuantity,
      clear,
      openCart,
      closeCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart precisa estar dentro de <CartProvider>.");
  return ctx;
}
