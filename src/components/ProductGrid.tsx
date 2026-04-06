"use client";

import { useMemo, useState } from "react";
import { useCatalog } from "@/context/CatalogContext";
import { useCatalogData } from "@/context/CatalogDataContext";
import { calcProduct } from "@/lib/pricing";
import { CATEGORY_LABELS, CATEGORY_ORDER, Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { MarginEditor } from "./MarginEditor";

export function ProductGrid() {
  const { activeCategory, searchQuery, globalSettings, overrides, categoryOverrides, isProductVisible } = useCatalog();
  const { allProducts } = useCatalogData();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const grouped = useMemo(() => {
    let filtered = allProducts.filter((p) => isProductVisible(p.id, p.soldOut));

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Filter by category
    if (activeCategory === "novidade") {
      filtered = filtered.filter((p) => p.tags.includes("novidade"));
    } else if (activeCategory === "colecao-exclusiva") {
      filtered = filtered.filter((p) => p.tags.includes("colecao-exclusiva"));
    } else if (activeCategory !== "todos") {
      filtered = filtered.filter((p) => p.category === activeCategory);
    }

    // Group by category
    if (activeCategory === "todos" || activeCategory === "novidade" || activeCategory === "colecao-exclusiva") {
      const groups: { category: string; products: Product[] }[] = [];
      const seen = new Set<number>();

      CATEGORY_ORDER.forEach((cat) => {
        const items = filtered.filter((p) => p.category === cat && !seen.has(p.id));
        items.forEach((p) => seen.add(p.id));
        if (items.length > 0) {
          groups.push({ category: cat, products: items });
        }
      });

      return groups;
    }

    return [{ category: activeCategory, products: filtered }];
  }, [allProducts, activeCategory, searchQuery]);

  const totalProducts = grouped.reduce((sum, g) => sum + g.products.length, 0);

  if (totalProducts === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p className="text-lg font-semibold">Nenhum produto encontrado</p>
        <p className="text-sm mt-1">Tente buscar por outro termo</p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-10">
        {grouped.map(({ category, products }) => (
          <section key={category}>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-xl font-bold text-brand-500">
                {CATEGORY_LABELS[category] || category}
              </h2>
              <span className="bg-brand-300 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                {products.length}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.map((product) => {
                const price = calcProduct(product, globalSettings, overrides[product.id], categoryOverrides[product.category]);
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    priceCalc={price}
                    hasOverride={!!overrides[product.id]}
                    onEdit={() => setEditingProduct(product)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {editingProduct && (
        <MarginEditor
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </>
  );
}
