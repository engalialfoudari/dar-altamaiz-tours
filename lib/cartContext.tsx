import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseServerCatalog, STORE_CATALOG, StoreProduct } from "./storeCatalog";
import { Alert } from "react-native";

export interface CartItem {
  productId: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (productId: string, quantity?: number) => void;
  addItems: (items: CartItem[]) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPriceKwd: number;
  stockByProductId: Record<string, number>;
  setStock: (stock: Record<string, number>) => void;
  catalog: StoreProduct[];
  setCatalog: (catalog: StoreProduct[]) => void;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = "DT_TOURS_CART";
const STOCK_STORAGE_KEY = "DT_TOURS_STOCK";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [stockByProductId, setStockByProductId] = useState<Record<string, number>>({});
  const [catalog, setCatalog] = useState<StoreProduct[]>(STORE_CATALOG);
  const save = (update: (current: CartItem[]) => CartItem[]) => {
    setItems((current) => {
      const next = update(current);
      AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const applyCatalog = (nextCatalog: StoreProduct[]) => {
    setCatalog(nextCatalog);
    save((current) => current.filter(item => nextCatalog.some(product => product.id === item.productId)));
  };

  useEffect(() => {
    AsyncStorage.getItem(CART_STORAGE_KEY).then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            // Validate against catalog
            const valid = parsed.filter(i => STORE_CATALOG.some(p => p.id === i.productId));
            setItems(valid);
          }
        } catch {}
      }
    });
    AsyncStorage.getItem(STOCK_STORAGE_KEY).then((data) => {
      if (data) try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === "object") setStockByProductId(parsed);
      } catch {}
    });
  }, []);

  useEffect(() => {
    const apiBase = (process.env.EXPO_PUBLIC_API_BASE || "https://tours-dar-tamaiz--engalialfoudari.replit.app/api").replace(/\/$/, "");
    const controller = new AbortController();
    fetch(`${apiBase}/store/products`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        applyCatalog(parseServerCatalog(payload));
        const rows = Array.isArray(payload) ? payload : payload?.products;
        const stock: Record<string, number> = {};
        if (Array.isArray(rows)) rows.forEach((row: any) => {
          const id = String(row.product_id ?? row.productId ?? row.id ?? "");
          const available = Number(row.available_stock ?? row.availableStock ?? row.stock);
          if (id && Number.isFinite(available)) stock[id] = Math.max(0, Math.floor(available));
        });
        setStock(stock);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const addToCart = (productId: string, quantity = 1) => {
    if (!catalog.some((product) => product.id === productId)) return;
    const safeQuantity = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)));
    save((current) => {
      const existing = current.find(i => i.productId === productId);
      const nextQuantity = (existing?.quantity || 0) + safeQuantity;
      const stock = stockByProductId[productId];
      if (stock !== undefined && nextQuantity > stock) {
        Alert.alert(`عذراً، الكمية المتاحة في المخزون هي ${stock} قطع فقط. يرجى تعديل الاختيار.`, "Requested quantity exceeds available stock.");
        return current;
      }
      return existing
        ? current.map(i => i.productId === productId ? { ...i, quantity: Math.min(99, nextQuantity) } : i)
        : [...current, { productId, quantity: safeQuantity }];
    });
  };

  const addItems = (incoming: CartItem[]) => {
    save((current) => {
      let exceededStock: number | null = null;
      const nextItems = incoming.reduce((next, item) => {
        if (!catalog.some((product) => product.id === item.productId)) return next;
        const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)));
        const existing = next.find((entry) => entry.productId === item.productId);
        const stock = stockByProductId[item.productId];
        const requested = (existing?.quantity ?? 0) + quantity;
        if (stock !== undefined && requested > stock) {
          exceededStock = stock;
          if (stock <= 0 || existing?.quantity === stock) return next;
        }
        const nextQuantity = stock === undefined ? Math.min(99, requested) : Math.min(stock, requested);
        return existing
          ? next.map((entry) => entry.productId === item.productId
            ? { ...entry, quantity: nextQuantity }
            : entry)
          : [...next, { productId: item.productId, quantity: nextQuantity }];
      }, [...current]);
      if (exceededStock !== null) {
        Alert.alert(`عذراً، الكمية المتاحة في المخزون هي ${exceededStock} قطع فقط.`, "The cart was limited to available stock.");
      }
      return nextItems;
    });
  };

  const removeFromCart = (productId: string) => {
    save((current) => current.filter(i => i.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      const stock = stockByProductId[productId];
      if (stock !== undefined && quantity > stock) {
        Alert.alert(`عذراً، الكمية المتاحة في المخزون هي ${stock} قطع فقط. يرجى تعديل الاختيار.`, "Requested quantity exceeds available stock.");
        return;
      }
      save((current) => current.map(i => i.productId === productId ? { ...i, quantity: Math.min(99, quantity) } : i));
    }
  };

  const clearCart = () => {
    save(() => []);
  };
  const setStock = (stock: Record<string, number>) => {
    setStockByProductId(stock);
    AsyncStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(stock)).catch(() => {});
  };

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalPriceKwd = items.reduce((acc, item) => {
    const product = catalog.find(p => p.id === item.productId);
    return acc + (product ? product.priceKwd * item.quantity : 0);
  }, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, addItems, removeFromCart, updateQuantity, clearCart, totalItems, totalPriceKwd, stockByProductId, setStock, catalog, setCatalog: applyCatalog }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
