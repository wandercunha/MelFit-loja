"use client";

import { useCatalog } from "@/context/CatalogContext";

export function SearchBar() {
  const { searchQuery, setSearchQuery } = useCatalog();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 no-print">
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar produtos..."
          className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-full bg-white focus:border-brand-300 focus:outline-none transition-colors text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}
