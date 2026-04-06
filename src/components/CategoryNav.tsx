"use client";

import { useCatalog } from "@/context/CatalogContext";
import { useCatalogData } from "@/context/CatalogDataContext";
import { Product } from "@/lib/types";

const CATEGORIES = [
  { key: "todos", label: "Todos" },
  { key: "novidade", label: "Novidades" },
  { key: "colecao-exclusiva", label: "Col. Exclusiva" },
  { key: "conjuntos", label: "Conjuntos" },
  { key: "tops", label: "Tops" },
  { key: "shorts", label: "Shorts" },
  { key: "leggings", label: "Leggings" },
  { key: "macaquinhos", label: "Macaquinhos" },
  { key: "macacoes", label: "Macacões" },
];

function getCategoryCount(key: string, products: Product[]): number {
  if (key === "todos") return products.length;
  if (key === "novidade") return products.filter((p) => p.tags.includes("novidade")).length;
  if (key === "colecao-exclusiva") return products.filter((p) => p.tags.includes("colecao-exclusiva")).length;
  return products.filter((p) => p.category === key).length;
}

export function CategoryNav() {
  const { activeCategory, setActiveCategory } = useCatalog();
  const { allProducts } = useCatalogData();

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 no-print sticky top-[64px] sm:top-[68px] z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <ul className="flex gap-1 overflow-x-auto py-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {CATEGORIES.map((cat) => {
            const count = getCategoryCount(cat.key, allProducts);
            return (
              <li key={cat.key} className="flex-shrink-0">
                <button
                  onClick={() => setActiveCategory(cat.key)}
                  className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                    activeCategory === cat.key
                      ? "bg-brand-400 text-white shadow-md"
                      : "text-gray-500 hover:text-brand-500 hover:bg-brand-50"
                  }`}
                >
                  {cat.label}
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeCategory === cat.key
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
