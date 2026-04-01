"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { GlobalSettings, ProductOverride, CategoryOverride, Category } from "@/lib/types";

interface CatalogState {
  isAdmin: boolean;
  globalSettings: GlobalSettings;
  overrides: Record<number, ProductOverride>;
  categoryOverrides: Record<string, CategoryOverride>;
  productVisibility: Record<number, boolean>;
  searchQuery: string;
  activeCategory: string;
}

interface CatalogContextType extends CatalogState {
  login: (user: string, pass: string) => Promise<boolean>;
  logout: () => void;
  apiSecret: string;
  setGlobalSettings: (s: GlobalSettings) => void;
  setOverride: (productId: number, o: ProductOverride) => void;
  removeOverride: (productId: number) => void;
  setCategoryOverride: (category: string, o: CategoryOverride) => void;
  removeCategoryOverride: (category: string) => void;
  setProductVisibility: (productId: number, visible: boolean) => void;
  isProductVisible: (productId: number, soldOut?: boolean) => boolean;
  setSearchQuery: (q: string) => void;
  setActiveCategory: (c: string) => void;
}

const CatalogContext = createContext<CatalogContextType | null>(null);

const STORAGE_KEY = "melfit_catalog_state";
const SESSION_KEY = "melfit_session";

function loadState(): Partial<CatalogState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveState(state: Pick<CatalogState, "globalSettings" | "overrides" | "categoryOverrides" | "productVisibility">) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function loadSession(): { token: string; expiry: number; apiSecret: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      if (session.expiry > Date.now()) return session;
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {}
  return null;
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [apiSecret, setApiSecret] = useState("");
  const [globalSettings, setGlobalSettingsState] = useState<GlobalSettings>({
    margin: 50,
    shipping: 0,
    cardRate: 13.99,
    pixDiscount: 4,
    installments: 6,
    whatsappNumber: "5511982863050",
    whatsappGreeting: "Ola! Gostaria de comprar essas pecas no site MelFit e fechar o pedido.",
    atacadoEmail: "",
    atacadoPassword: "",
  });
  const [overrides, setOverrides] = useState<Record<number, ProductOverride>>({});
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, CategoryOverride>>({});
  const [productVisibility, setProductVisibilityState] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("todos");

  useEffect(() => {
    const saved = loadState();
    if (saved.globalSettings) setGlobalSettingsState(saved.globalSettings);
    if (saved.overrides) setOverrides(saved.overrides as Record<number, ProductOverride>);
    if ((saved as any).categoryOverrides) setCategoryOverrides((saved as any).categoryOverrides as Record<string, CategoryOverride>);
    if ((saved as any).productVisibility) setProductVisibilityState((saved as any).productVisibility as Record<number, boolean>);

    // Restore session
    const session = loadSession();
    if (session) {
      setIsAdmin(true);
      setApiSecret(session.apiSecret);
    }
  }, []);

  const persist = useCallback(
    (gs: GlobalSettings, ov: Record<number, ProductOverride>, co: Record<string, CategoryOverride>, pv: Record<number, boolean>) => {
      saveState({ globalSettings: gs, overrides: ov, categoryOverrides: co, productVisibility: pv });
    },
    []
  );

  const login = async (user: string, pass: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, pass }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.success) {
        setIsAdmin(true);
        setApiSecret(data.apiSecret);
        if (typeof window !== "undefined") {
          localStorage.setItem(SESSION_KEY, JSON.stringify({
            token: data.token,
            expiry: data.expiry,
            apiSecret: data.apiSecret,
          }));
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setIsAdmin(false);
    setApiSecret("");
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
    }
  };

  const setGlobalSettings = (s: GlobalSettings) => {
    setGlobalSettingsState(s);
    persist(s, overrides, categoryOverrides, productVisibility);
  };

  const setOverride = (productId: number, o: ProductOverride) => {
    const next = { ...overrides, [productId]: o };
    setOverrides(next);
    persist(globalSettings, next, categoryOverrides, productVisibility);
  };

  const removeOverride = (productId: number) => {
    const next = { ...overrides };
    delete next[productId];
    setOverrides(next);
    persist(globalSettings, next, categoryOverrides, productVisibility);
  };

  const setCategoryOverride = (category: string, o: CategoryOverride) => {
    const next = { ...categoryOverrides, [category]: o };
    setCategoryOverrides(next);
    persist(globalSettings, overrides, next, productVisibility);
  };

  const removeCategoryOverride = (category: string) => {
    const next = { ...categoryOverrides };
    delete next[category];
    setCategoryOverrides(next);
    persist(globalSettings, overrides, next, productVisibility);
  };

  const setProductVisibility = (productId: number, visible: boolean) => {
    const next = { ...productVisibility, [productId]: visible };
    setProductVisibilityState(next);
    persist(globalSettings, overrides, categoryOverrides, next);
  };

  const isProductVisible = (productId: number, soldOut?: boolean) => {
    if (productId in productVisibility) return productVisibility[productId];
    return !soldOut;
  };

  return (
    <CatalogContext.Provider
      value={{
        isAdmin,
        globalSettings,
        overrides,
        categoryOverrides,
        productVisibility,
        searchQuery,
        activeCategory,
        apiSecret,
        login,
        logout,
        setGlobalSettings,
        setOverride,
        removeOverride,
        setCategoryOverride,
        removeCategoryOverride,
        setProductVisibility,
        isProductVisible,
        setSearchQuery,
        setActiveCategory,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used within CatalogProvider");
  return ctx;
}
