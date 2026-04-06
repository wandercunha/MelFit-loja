"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

import { Product, Category } from "@/lib/types";
import { PRODUCTS } from "@/data/products";

import urlOverrides from "@/data/url-overrides.json";

// Fallback: dados estáticos (usados até o banco responder)
import staticAtacado from "@/data/atacado-details.json";
import staticScrapeMaps from "@/data/scrape-maps.json";
import staticProductInfo from "@/data/product-info.json";

interface ConjuntoPiece {
  name: string;
  sizes: Record<string, number>;
  price: number;
}

interface AtacadoProduct {
  name: string;
  atacadoSlug: string;
  images: string[];
  stock: Record<string, number>;
  totalStock: number;
  price: number;
  folder: string;
  pieces?: ConjuntoPiece[];
}

interface CatalogData {
  atacadoProducts: Record<string, AtacadoProduct>;
  atacadoByName: Record<string, any>;
  varejoPrecos: Record<string, number>;
  productInfo: Record<string, any>;
  customProducts: Product[];
  allProducts: Product[];  // PRODUCTS + customProducts mesclados
  addCustomProduct: (product: Product) => Promise<void>;
  removeCustomProduct: (productId: number) => Promise<void>;
  dataSource: "static" | "turso";
  updatedAt: string | null;
  loading: boolean;
}

const CatalogDataContext = createContext<CatalogData | null>(null);

export function CatalogDataProvider({ children }: { children: React.ReactNode }) {
  const [atacadoProducts, setAtacadoProducts] = useState<Record<string, AtacadoProduct>>((staticAtacado as any).products || {});
  const [varejoPrecos, setVarejoPrecos] = useState<Record<string, number>>((staticScrapeMaps as any).priceMap || {});
  const [productInfo, setProductInfo] = useState<Record<string, any>>((staticProductInfo as any).products || {});
  const [customProducts, setCustomProducts] = useState<Product[]>([]);
  const [dataSource, setDataSource] = useState<"static" | "turso">("static");
  const [updatedAt, setUpdatedAt] = useState<string | null>((staticAtacado as any).timestamp || null);
  const [dbUrlOverrides, setDbUrlOverrides] = useState<Record<string, { atacadoSlug: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/catalog-data")
      .then((res) => {
        if (!res.ok) throw new Error("no data");
        return res.json();
      })
      .then((json) => {
        const atacado = json.atacado?.products || json.atacado;
        const varejo = json.varejoPrecos;
        const pInfo = json.productInfo?.products || json.productInfo;
        const custom = json.customProducts || [];
        const dbOverrides = json.urlOverrides || {};
        if (atacado && Object.keys(atacado).length > 0) {
          setAtacadoProducts(atacado);
          if (varejo) setVarejoPrecos(varejo);
          if (pInfo && Object.keys(pInfo).length > 0) setProductInfo(pInfo);
          setCustomProducts(custom);
          setDbUrlOverrides(dbOverrides);
          setDataSource("turso");
          setUpdatedAt(json.updatedAt);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const addCustomProduct = async (product: Product) => {
    const next = [...customProducts, product];
    setCustomProducts(next);
    // Persistir no Turso via settings API
    try {
      const session = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("melfit_session") || "{}") : {};
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.apiSecret || ""}` },
        body: JSON.stringify({ catalog_custom_products: JSON.stringify(next) }),
      });
    } catch {}
  };

  const removeCustomProduct = async (productId: number) => {
    const next = customProducts.filter((p) => p.id !== productId);
    setCustomProducts(next);
    try {
      const session = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("melfit_session") || "{}") : {};
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.apiSecret || ""}` },
        body: JSON.stringify({ catalog_custom_products: JSON.stringify(next) }),
      });
    } catch {}
  };

  // Indice por nome para lookup O(1) no ProductCard
  // Inclui overrides de url-overrides.json (nome do catálogo → slug do atacado)
  const atacadoByName = useMemo(() => {
    const map: Record<string, any> = {};
    for (const [slug, p] of Object.entries(atacadoProducts)) {
      if ((p as any).name) map[(p as any).name] = { ...(p as any), _slug: slug };
    }
    // Overrides: JSON estático + DB (admin vinculou URL)
    const allOverrides = { ...(urlOverrides as any).products, ...dbUrlOverrides };
    for (const [catalogName, override] of Object.entries(allOverrides)) {
      if (map[catalogName]) continue;
      const atacadoSlug = (override as any).atacadoSlug;
      if (!atacadoSlug) continue;
      const baseSlug = atacadoSlug.replace(/-at$/, "");
      const matched = atacadoProducts[baseSlug];
      if (matched) map[catalogName] = { ...(matched as any), _slug: baseSlug };
    }
    return map;
  }, [atacadoProducts, dbUrlOverrides]);

  // PRODUCTS estáticos + customProducts do banco, mesclados
  const allProducts = useMemo(() => {
    const ids = new Set(PRODUCTS.map((p) => p.id));
    const extras = customProducts.filter((p) => !ids.has(p.id));
    return [...PRODUCTS, ...extras];
  }, [customProducts]);

  const value = useMemo<CatalogData>(
    () => ({
      atacadoProducts, atacadoByName, varejoPrecos, productInfo,
      customProducts, allProducts, addCustomProduct, removeCustomProduct,
      dataSource, updatedAt, loading,
    }),
    [atacadoProducts, atacadoByName, varejoPrecos, productInfo, customProducts, allProducts, dataSource, updatedAt, loading],
  );

  return (
    <CatalogDataContext.Provider value={value}>
      {children}
    </CatalogDataContext.Provider>
  );
}

export function useCatalogData() {
  const ctx = useContext(CatalogDataContext);
  if (!ctx) throw new Error("useCatalogData must be used within CatalogDataProvider");
  return ctx;
}
