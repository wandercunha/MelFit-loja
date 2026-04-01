"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { CartItem, CartCustomer, PaymentMethod } from "@/lib/types";

interface CartContextType {
  items: CartItem[];
  customer: CartCustomer;
  cartId: string;
  addItem: (item: CartItem) => void;
  removeItem: (productId: number, size: string) => void;
  updateQuantity: (productId: number, size: string, qty: number) => void;
  clearCart: () => void;
  setCustomer: (c: Partial<CartCustomer>) => void;
  totalItems: number;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_KEY = "melfit_cart";
const CUSTOMER_KEY = "melfit_customer";
const CART_ID_KEY = "melfit_cart_id";

function generateCartId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `MF-${ts}-${rand}`.toUpperCase();
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customer, setCustomerState] = useState<CartCustomer>({
    name: "",
    phone: "",
    email: "",
  });
  const [cartId, setCartId] = useState("");

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedItems = localStorage.getItem(CART_KEY);
      if (savedItems) setItems(JSON.parse(savedItems));

      const savedCustomer = localStorage.getItem(CUSTOMER_KEY);
      if (savedCustomer) setCustomerState(JSON.parse(savedCustomer));

      let id = localStorage.getItem(CART_ID_KEY);
      if (!id) {
        id = generateCartId();
        localStorage.setItem(CART_ID_KEY, id);
      }
      setCartId(id);
    } catch {}
  }, []);

  const persist = useCallback((newItems: CartItem[]) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(CART_KEY, JSON.stringify(newItems));
  }, []);

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.productId === item.productId && i.size === item.size
      );
      let next: CartItem[];
      if (existing) {
        next = prev.map((i) =>
          i.productId === item.productId && i.size === item.size
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      } else {
        next = [...prev, item];
      }
      persist(next);
      return next;
    });
  };

  const removeItem = (productId: number, size: string) => {
    setItems((prev) => {
      const next = prev.filter(
        (i) => !(i.productId === productId && i.size === size)
      );
      persist(next);
      return next;
    });
  };

  const updateQuantity = (productId: number, size: string, qty: number) => {
    if (qty <= 0) return removeItem(productId, size);
    setItems((prev) => {
      const next = prev.map((i) =>
        i.productId === productId && i.size === size
          ? { ...i, quantity: qty }
          : i
      );
      persist(next);
      return next;
    });
  };

  const clearCart = () => {
    setItems([]);
    persist([]);
    // New cart ID
    const newId = generateCartId();
    setCartId(newId);
    if (typeof window !== "undefined") {
      localStorage.setItem(CART_ID_KEY, newId);
    }
  };

  const setCustomer = (c: Partial<CartCustomer>) => {
    setCustomerState((prev) => {
      const next = { ...prev, ...c };
      if (typeof window !== "undefined") {
        localStorage.setItem(CUSTOMER_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        customer,
        cartId,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        setCustomer,
        totalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
