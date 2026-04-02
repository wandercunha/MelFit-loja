"use client";

import { Header } from "@/components/Header";
import { CategoryNav } from "@/components/CategoryNav";
import { SearchBar } from "@/components/SearchBar";
import { ProductGrid } from "@/components/ProductGrid";
import { useCatalog } from "@/context/CatalogContext";
import { useCatalogData } from "@/context/CatalogDataContext";

export default function Home() {
  const { isAdmin } = useCatalog();
  const { updatedAt, dataSource } = useCatalogData();

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
        + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch { return null; }
  };

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
        {updatedAt && (
          <p className="mt-2 text-[10px] text-gray-700">
            Atualizado em {formatDate(updatedAt)}
          </p>
        )}
      </footer>
    </div>
  );
}
