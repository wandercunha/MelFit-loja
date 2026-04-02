"use client";

import { useCatalog } from "@/context/CatalogContext";
import { useCart } from "@/context/CartContext";
import { PRODUCTS } from "@/data/products";
import { useState, useEffect } from "react";
import { LoginModal } from "./LoginModal";
import { CartDrawer } from "./CartDrawer";
import { AdminPanel } from "./admin/AdminPanel";

export function Header() {
  const { isAdmin, logout, isProductVisible } = useCatalog();
  const { totalItems } = useCart();
  const [showLogin, setShowLogin] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const available = PRODUCTS.filter((p) => isProductVisible(p.id, p.soldOut)).length;

  // Escuta evento de fechar admin (disparado pelo "Ver no catalogo")
  useEffect(() => {
    const handler = () => setShowAdmin(false);
    window.addEventListener("melfit:close-admin", handler);
    return () => window.removeEventListener("melfit:close-admin", handler);
  }, []);

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
            {/* Cart button (client view) */}
            {!isAdmin && (
              <button
                onClick={() => setShowCart(true)}
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-brand-300 text-surface-dark text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
              </button>
            )}

            {isAdmin ? (
              <>
                <button
                  onClick={() => setShowAdmin(true)}
                  className="text-xs text-brand-300 font-semibold bg-brand-300/10 px-2.5 sm:px-3 py-1 rounded-full hover:bg-brand-300/20 transition-colors cursor-pointer"
                >
                  <span className="hidden sm:inline">CONFIGURACOES</span>
                  <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
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
      {showCart && <CartDrawer open={showCart} onClose={() => setShowCart(false)} />}
      {isAdmin && showAdmin && (
        <AdminPanel open={showAdmin} onClose={() => setShowAdmin(false)} />
      )}
    </>
  );
}
