"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

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
  dataSource: "static" | "turso";
  updatedAt: string | null;
  loading: boolean;
}

const CatalogDataContext = createContext<CatalogData | null>(null);

export function CatalogDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Omit<CatalogData, "atacadoByName">>({
    atacadoProducts: (staticAtacado as any).products || {},
    varejoPrecos: (staticScrapeMaps as any).priceMap || {},
    productInfo: (staticProductInfo as any).products || {},
    dataSource: "static",
    updatedAt: (staticAtacado as any).timestamp || null,
    loading: true,
  });

  useEffect(() => {
    // Tenta carregar dados atualizados do Turso
    fetch("/api/catalog-data")
      .then((res) => {
        if (!res.ok) throw new Error("no data");
        return res.json();
      })
      .then((json) => {
        const atacado = json.atacado?.products || json.atacado;
        const varejo = json.varejoPrecos;
        const pInfo = json.productInfo?.products || json.productInfo;
        if (atacado && Object.keys(atacado).length > 0) {
          setData((prev) => ({
            atacadoProducts: atacado,
            varejoPrecos: varejo || prev.varejoPrecos,
            productInfo: (pInfo && Object.keys(pInfo).length > 0) ? pInfo : prev.productInfo,
            dataSource: "turso",
            updatedAt: json.updatedAt,
            loading: false,
          }));
        } else {
          setData((prev) => ({ ...prev, loading: false }));
        }
      })
      .catch(() => {
        // Fallback: usa dados estáticos
        setData((prev) => ({ ...prev, loading: false }));
      });
  }, []);

  // Indice por nome para lookup O(1) no ProductCard
  const atacadoByName = useMemo(() => {
    const map: Record<string, any> = {};
    for (const [slug, p] of Object.entries(data.atacadoProducts)) {
      if ((p as any).name) map[(p as any).name] = { ...(p as any), _slug: slug };
    }
    return map;
  }, [data.atacadoProducts]);

  const value = useMemo<CatalogData>(
    () => ({ ...data, atacadoByName }),
    [data, atacadoByName],
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
