"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

// Fallback: dados estáticos (usados até o banco responder)
import staticAtacado from "@/data/atacado-details.json";
import staticScrapeMaps from "@/data/scrape-maps.json";

interface AtacadoProduct {
  name: string;
  atacadoSlug: string;
  images: string[];
  stock: Record<string, number>;
  totalStock: number;
  price: number;
  folder: string;
}

interface CatalogData {
  atacadoProducts: Record<string, AtacadoProduct>;
  varejoPrecos: Record<string, number>;
  dataSource: "static" | "turso";
  updatedAt: string | null;
  loading: boolean;
}

const CatalogDataContext = createContext<CatalogData | null>(null);

export function CatalogDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<CatalogData>({
    atacadoProducts: (staticAtacado as any).products || {},
    varejoPrecos: (staticScrapeMaps as any).priceMap || {},
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
        if (atacado && Object.keys(atacado).length > 0) {
          setData({
            atacadoProducts: atacado,
            varejoPrecos: varejo || data.varejoPrecos,
            dataSource: "turso",
            updatedAt: json.updatedAt,
            loading: false,
          });
        } else {
          setData((prev) => ({ ...prev, loading: false }));
        }
      })
      .catch(() => {
        // Fallback: usa dados estáticos
        setData((prev) => ({ ...prev, loading: false }));
      });
  }, []);

  return (
    <CatalogDataContext.Provider value={data}>
      {children}
    </CatalogDataContext.Provider>
  );
}

export function useCatalogData() {
  const ctx = useContext(CatalogDataContext);
  if (!ctx) throw new Error("useCatalogData must be used within CatalogDataProvider");
  return ctx;
}
