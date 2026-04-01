"use client";

import { Header } from "@/components/Header";
import { CategoryNav } from "@/components/CategoryNav";
import { SearchBar } from "@/components/SearchBar";
import { ProductGrid } from "@/components/ProductGrid";
import { useCatalog } from "@/context/CatalogContext";

export default function Home() {
  const { isAdmin } = useCatalog();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <CategoryNav />
      <SearchBar />

      {/* Main content */}
      <main className="flex-1">
        <ProductGrid />
      </main>

      {/* Footer */}
      <footer className="bg-surface-dark text-gray-500 text-center py-8 text-sm no-print">
        <p>
          Catalogo de Revenda &mdash; Produtos originais{" "}
          <a
            href="https://www.floraamaratacado.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-300 hover:underline"
          >
            Flora Amar Atacado
          </a>
        </p>
        <p className="mt-1 text-xs text-gray-600">
          Precos sujeitos a alteracao sem aviso previo
        </p>
      </footer>
    </div>
  );
}
