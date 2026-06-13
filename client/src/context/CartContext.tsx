import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';
import type { Cart } from '../lib/types';
import { useToast } from './ToastContext';
import { storage } from '../lib/storage';

interface CartContextValue {
  cart: Cart | null;
  busy: boolean;
  addItem: (productId: number, qty: number) => Promise<void>;
  updateItem: (itemId: number, qty: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_KEY = 'ao_cart_id';

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const createCart = useCallback(async (): Promise<Cart> => {
    const res = await api<{ cart: Cart }>('/cart', { method: 'POST' });
    storage.setItem(CART_KEY, res.cart.id);
    setCart(res.cart);
    return res.cart;
  }, []);

  const refresh = useCallback(async () => {
    const id = storage.getItem(CART_KEY);
    if (!id) return;
    try {
      const res = await api<{ cart: Cart }>(`/cart/${id}`);
      setCart(res.cart);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
        storage.removeItem(CART_KEY);
        setCart(null);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (productId: number, qty: number) => {
      setBusy(true);
      try {
        let id = storage.getItem(CART_KEY);
        if (!id) id = (await createCart()).id;
        const res = await api<{ cart: Cart }>(`/cart/${id}/items`, {
          method: 'POST',
          body: { productId, qty },
        });
        setCart(res.cart);
        toast('Added to bag');
      } catch (err) {
        toast(err instanceof ApiError ? err.message : 'Could not add to bag', 'error');
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [createCart, toast]
  );

  const updateItem = useCallback(
    async (itemId: number, qty: number) => {
      const id = storage.getItem(CART_KEY);
      if (!id) return;
      setBusy(true);
      try {
        const res = await api<{ cart: Cart }>(`/cart/${id}/items/${itemId}`, {
          method: 'PATCH',
          body: { qty },
        });
        setCart(res.cart);
      } catch (err) {
        toast(err instanceof ApiError ? err.message : 'Could not update item', 'error');
      } finally {
        setBusy(false);
      }
    },
    [toast]
  );

  const removeItem = useCallback(
    async (itemId: number) => {
      const id = storage.getItem(CART_KEY);
      if (!id) return;
      setBusy(true);
      try {
        const res = await api<{ cart: Cart }>(`/cart/${id}/items/${itemId}`, { method: 'DELETE' });
        setCart(res.cart);
      } catch (err) {
        toast(err instanceof ApiError ? err.message : 'Could not remove item', 'error');
      } finally {
        setBusy(false);
      }
    },
    [toast]
  );

  return (
    <CartContext.Provider value={{ cart, busy, addItem, updateItem, removeItem, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
