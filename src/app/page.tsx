"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { CategoryNav } from "@/components/CategoryNav";
import { SearchBar } from "@/components/SearchBar";
import { ProductGrid } from "@/components/ProductGrid";
import { AdminPanel } from "@/components/AdminPanel";
import { useCatalog } from "@/context/CatalogContext";

export default function Home() {
  const { isAdmin } = useCatalog();
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <CategoryNav />
      <SearchBar />

      {/* Admin floating button */}
      {isAdmin && (
        <button
          onClick={() => setPanelOpen(true)}
          className="no-print fixed bottom-6 right-6 z-50 bg-brand-400 hover:bg-brand-500 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110"
          title="Configurações de margem"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      )}

      {/* Main content */}
      <main className="flex-1">
        <ProductGrid />
      </main>

      {/* Footer */}
      <footer className="bg-surface-dark text-gray-500 text-center py-8 text-sm no-print">
        <p>
          Catálogo de Revenda &mdash; Produtos originais{" "}
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
          Preços sujeitos a alteração sem aviso prévio
        </p>
      </footer>

      {/* Admin Panel */}
      <AdminPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}
