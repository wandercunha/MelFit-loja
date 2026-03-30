"use client";

import { useCatalog } from "@/context/CatalogContext";
import { useState } from "react";
import { LoginModal } from "./LoginModal";

export function Header() {
  const { isAdmin, logout } = useCatalog();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <header className="bg-gradient-to-r from-surface-dark to-gray-800 text-white sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-wider">
              <span className="text-brand-300">Mel</span>
              <span className="font-light">Fit</span>
            </h1>
            <span className="hidden sm:block text-xs text-gray-400 border-l border-gray-600 pl-3">
              Moda Fitness
            </span>
          </div>

          <div className="flex items-center gap-3">
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
