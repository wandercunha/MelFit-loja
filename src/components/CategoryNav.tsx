"use client";

import { useCatalog } from "@/context/CatalogContext";
import { CATEGORY_LABELS } from "@/lib/types";

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

export function CategoryNav() {
  const { activeCategory, setActiveCategory } = useCatalog();

  return (
    <nav className="bg-white/50 backdrop-blur border-b border-gray-100 no-print sticky top-[68px] z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <ul className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <li key={cat.key} className="flex-shrink-0">
              <button
                onClick={() => setActiveCategory(cat.key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                  activeCategory === cat.key
                    ? "bg-brand-400 text-white shadow-md"
                    : "text-gray-500 hover:text-brand-500 hover:bg-brand-50"
                }`}
              >
                {cat.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
