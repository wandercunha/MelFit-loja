"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { GlobalSettings, ProductOverride } from "@/lib/types";

interface CatalogState {
  isAdmin: boolean;
  globalSettings: GlobalSettings;
  overrides: Record<number, ProductOverride>;
  searchQuery: string;
  activeCategory: string;
}

interface CatalogContextType extends CatalogState {
  login: (user: string, pass: string) => boolean;
  logout: () => void;
  setGlobalSettings: (s: GlobalSettings) => void;
  setOverride: (productId: number, o: ProductOverride) => void;
  removeOverride: (productId: number) => void;
  setSearchQuery: (q: string) => void;
  setActiveCategory: (c: string) => void;
}

const CatalogContext = createContext<CatalogContextType | null>(null);

const STORAGE_KEY = "melfit_catalog_state";
const ADMIN_USER = "admin";
const ADMIN_PASS = "flora2024";

function loadState(): Partial<CatalogState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveState(state: Pick<CatalogState, "globalSettings" | "overrides">) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [globalSettings, setGlobalSettingsState] = useState<GlobalSettings>({
    margin: 50,
    shipping: 0,
    cardRate: 13.99,
    pixDiscount: 4,
    installments: 6,
  });
  const [overrides, setOverrides] = useState<Record<number, ProductOverride>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("todos");

  useEffect(() => {
    const saved = loadState();
    if (saved.globalSettings) setGlobalSettingsState(saved.globalSettings);
    if (saved.overrides) setOverrides(saved.overrides as Record<number, ProductOverride>);
  }, []);

  const persist = useCallback(
    (gs: GlobalSettings, ov: Record<number, ProductOverride>) => {
      saveState({ globalSettings: gs, overrides: ov });
    },
    []
  );

  const login = (user: string, pass: string): boolean => {
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const logout = () => setIsAdmin(false);

  const setGlobalSettings = (s: GlobalSettings) => {
    setGlobalSettingsState(s);
    persist(s, overrides);
  };

  const setOverride = (productId: number, o: ProductOverride) => {
    const next = { ...overrides, [productId]: o };
    setOverrides(next);
    persist(globalSettings, next);
  };

  const removeOverride = (productId: number) => {
    const next = { ...overrides };
    delete next[productId];
    setOverrides(next);
    persist(globalSettings, next);
  };

  return (
    <CatalogContext.Provider
      value={{
        isAdmin,
        globalSettings,
        overrides,
        searchQuery,
        activeCategory,
        login,
        logout,
        setGlobalSettings,
        setOverride,
        removeOverride,
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
