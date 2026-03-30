"use client";

import { useCatalog } from "@/context/CatalogContext";
import { PRODUCTS } from "@/data/products";
import { useState } from "react";
import { LoginModal } from "./LoginModal";

export function Header() {
  const { isAdmin, logout } = useCatalog();
  const [showLogin, setShowLogin] = useState(false);
  const available = PRODUCTS.filter((p) => !p.soldOut).length;

  return (
    <>
      <header className="bg-gradient-to-r from-surface-dark to-gray-800 text-white sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-3xl font-black tracking-wider">
              <span className="text-brand-300">Mel</span>
              <span className="font-light">Fit</span>
            </h1>
            <div className="hidden sm:flex flex-col border-l border-gray-600 pl-3">
              <span className="text-xs text-gray-400 leading-tight">Moda Fitness</span>
              <span className="text-[10px] text-gray-500 leading-tight">{available} produtos</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin ? (
              <>
                <span className="hidden sm:block text-xs text-brand-300 font-semibold bg-brand-300/10 px-3 py-1 rounded-full">
                  ADMIN
                </span>
                <button onClick={logout} className="btn-outline text-xs">
                  Sair
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="btn-outline text-xs"
              >
                Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
