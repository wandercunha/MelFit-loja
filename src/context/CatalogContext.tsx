"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { GlobalSettings, ProductOverride, CategoryOverride } from "@/lib/types";
import { PRODUCTS } from "@/data/products";
import { useCatalogData } from "@/context/CatalogDataContext";

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
  refreshFromDb: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  setActiveCategory: (c: string) => void;
}

const CatalogContext = createContext<CatalogContextType | null>(null);

const STORAGE_KEY = "melfit_catalog_state";
const SESSION_KEY = "melfit_session";

// ─── Chaves usadas no banco ───
const DB_KEYS = {
  globalSettings: "catalog_global_settings",
  overrides: "catalog_overrides",
  categoryOverrides: "catalog_category_overrides",
  productVisibility: "catalog_product_visibility",
};

// ─── LocalStorage (cache/fallback) ───
function loadLocalState(): Partial<CatalogState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveLocalState(state: Pick<CatalogState, "globalSettings" | "overrides" | "categoryOverrides" | "productVisibility">) {
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

// ─── Default values ───
const DEFAULT_SETTINGS: GlobalSettings = {
  margin: 50,
  shipping: 0,
  cardRate: 13.99,
  pixDiscount: 4,
  installments: 6,
  whatsappNumber: "5511982863050",
  whatsappGreeting: "Ola! Gostaria de comprar essas pecas no site MelFit e fechar o pedido.",
  atacadoEmail: "",
  atacadoPassword: "",
};

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const { atacadoProducts } = useCatalogData();
  const [isAdmin, setIsAdmin] = useState(false);
  const [apiSecret, setApiSecret] = useState("");
  const [globalSettings, setGlobalSettingsState] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [overrides, setOverrides] = useState<Record<number, ProductOverride>>({});
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, CategoryOverride>>({});
  const [productVisibility, setProductVisibilityState] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("todos");
  const [dbLoaded, setDbLoaded] = useState(false);

  // Ref para debounce do sync com banco
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Carrega estado do localStorage (imediato) e banco (async) ──
  useEffect(() => {
    // 1. Carrega do localStorage para resposta imediata
    const saved = loadLocalState();
    if (saved.globalSettings) setGlobalSettingsState(saved.globalSettings);
    if (saved.overrides) setOverrides(saved.overrides as Record<number, ProductOverride>);
    if ((saved as any).categoryOverrides) setCategoryOverrides((saved as any).categoryOverrides);
    if ((saved as any).productVisibility) setProductVisibilityState((saved as any).productVisibility);

    // 2. Restaura sessão
    const session = loadSession();
    if (session) {
      setIsAdmin(true);
      setApiSecret(session.apiSecret);
      // 3. Se logado, carrega do banco (prioridade)
      loadFromDb(session.apiSecret);
    }
  }, []);

  // ── Carregar do banco ──
  const loadFromDb = async (secret: string) => {
    try {
      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (!res.ok) return;
      const data = await res.json();

      let hasData = false;
      if (data[DB_KEYS.globalSettings]) {
        try { setGlobalSettingsState(JSON.parse(data[DB_KEYS.globalSettings])); hasData = true; } catch {}
      }
      if (data[DB_KEYS.overrides]) {
        try { setOverrides(JSON.parse(data[DB_KEYS.overrides])); hasData = true; } catch {}
      }
      if (data[DB_KEYS.categoryOverrides]) {
        try { setCategoryOverrides(JSON.parse(data[DB_KEYS.categoryOverrides])); hasData = true; } catch {}
      }
      if (data[DB_KEYS.productVisibility]) {
        try { setProductVisibilityState(JSON.parse(data[DB_KEYS.productVisibility])); hasData = true; } catch {}
      }

      setDbLoaded(true);

      // Atualiza localStorage com dados do banco
      if (hasData) {
        const gs = data[DB_KEYS.globalSettings] ? JSON.parse(data[DB_KEYS.globalSettings]) : DEFAULT_SETTINGS;
        const ov = data[DB_KEYS.overrides] ? JSON.parse(data[DB_KEYS.overrides]) : {};
        const co = data[DB_KEYS.categoryOverrides] ? JSON.parse(data[DB_KEYS.categoryOverrides]) : {};
        const pv = data[DB_KEYS.productVisibility] ? JSON.parse(data[DB_KEYS.productVisibility]) : {};
        saveLocalState({ globalSettings: gs, overrides: ov, categoryOverrides: co, productVisibility: pv });
      }
    } catch {
      // Offline ou erro — usa localStorage (já carregado)
    }
  };

  // ── Salvar no banco (debounced 1s) + localStorage (imediato) ──
  const persist = useCallback(
    (gs: GlobalSettings, ov: Record<number, ProductOverride>, co: Record<string, CategoryOverride>, pv: Record<number, boolean>) => {
      // localStorage imediato
      saveLocalState({ globalSettings: gs, overrides: ov, categoryOverrides: co, productVisibility: pv });

      // Banco com debounce (evita salvar a cada tecla)
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        const session = loadSession();
        if (!session) return;
        fetch("/api/settings", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.apiSecret}`,
          },
          body: JSON.stringify({
            [DB_KEYS.globalSettings]: JSON.stringify(gs),
            [DB_KEYS.overrides]: JSON.stringify(ov),
            [DB_KEYS.categoryOverrides]: JSON.stringify(co),
            [DB_KEYS.productVisibility]: JSON.stringify(pv),
          }),
        }).catch(() => {}); // falha silenciosa se offline
      }, 1000);
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
        // Carrega configs do banco ao logar
        await loadFromDb(data.apiSecret);
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

  // Mapa productId → totalStock do atacado (atualiza quando atacadoProducts muda)
  const atacadoStockById = useMemo(() => {
    const toSlug = (name: string) =>
      name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+c\/\s*/g, "-c-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const map: Record<number, number> = {};
    for (const p of PRODUCTS) {
      const slug = p.slug || toSlug(p.name);
      const at = atacadoProducts[slug]
        || Object.values(atacadoProducts).find((d: any) => d.name === p.name);
      if (at) {
        // Conjuntos com peças = disponível (totalStock pode ser 0 pois usam grade_biquini)
        const hasPieces = (at as any).pieces && (at as any).pieces.length > 0;
        map[p.id] = hasPieces ? 1 : (at as any).totalStock;
      }
    }
    return map;
  }, [atacadoProducts]);

  const isProductVisible = useCallback((productId: number, soldOut?: boolean) => {
    if (productId in productVisibility) return productVisibility[productId];
    // Atacado stock > 0 sobrescreve soldOut do products.ts
    if (soldOut && productId in atacadoStockById && atacadoStockById[productId] > 0) {
      return true;
    }
    return !soldOut;
  }, [productVisibility, atacadoStockById]);

  const refreshFromDb = async () => {
    const session = loadSession();
    if (session) await loadFromDb(session.apiSecret);
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
        refreshFromDb,
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
