"use client";

import { Product, PriceCalc, CATEGORY_LABELS } from "@/lib/types";
import { formatBRL, getColorFromName, getInitials } from "@/lib/pricing";
import { useCatalog } from "@/context/CatalogContext";
import { useState } from "react";

interface Props {
  product: Product;
  priceCalc: PriceCalc;
  hasOverride: boolean;
  onEdit: () => void;
}

export function ProductCard({ product, priceCalc, hasOverride, onEdit }: Props) {
  const { isAdmin } = useCatalog();
  const color = getColorFromName(product.name);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="card overflow-hidden group">
      {/* Image */}
      <div
        className="relative w-full aspect-[3/4] flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${color}15, ${color}30)`,
        }}
      >
        {product.img && !imgError ? (
          <img
            src={product.img}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <span
            className="text-4xl font-black opacity-20"
            style={{ color }}
          >
            {getInitials(product.name)}
          </span>
        )}

        {product.soldOut && (
          <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Esgotado
          </span>
        )}

        {product.tags.includes("novidade") && !product.soldOut && !isAdmin && (
          <span className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
            Novo
          </span>
        )}

        {isAdmin && (
          <button
            onClick={onEdit}
            className="absolute top-3 right-3 bg-brand-400 text-white w-9 h-9 rounded-full flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg hover:bg-brand-500 hover:scale-110"
            title="Editar margem"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1">
          {CATEGORY_LABELS[product.category]}
        </p>
        <h3 className="font-semibold text-sm text-gray-800 leading-snug mb-1.5">
          {product.name}
        </h3>
        <p className="text-xs text-gray-400 mb-3">Tam: {product.sizes}</p>

        {/* === CLIENT VIEW: 3 prices === */}
        {!isAdmin && (
          <div className="space-y-1.5">
            {/* PIX - destaque */}
            <div className="bg-emerald-50 rounded-lg px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-200 px-1.5 py-0.5 rounded">PIX</span>
                <span className="text-lg font-extrabold text-emerald-700">
                  {formatBRL(priceCalc.pricePix)}
                </span>
              </div>
              <p className="text-[10px] text-emerald-600 mt-0.5">
                {priceCalc.pixDiscount}% de desconto
              </p>
            </div>
            {/* Cartão à vista */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-gray-400">Cartao:</span>
              <span className="text-sm font-bold text-gray-700">
                {formatBRL(priceCalc.priceCard)}
              </span>
            </div>
            {/* Parcelado */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-gray-400">Parcelado:</span>
              <span className="text-sm font-bold text-brand-500">
                {priceCalc.installments}x de {formatBRL(priceCalc.installmentMonthly)}
              </span>
            </div>
            <p className="text-[10px] text-gray-400">
              Total: {formatBRL(priceCalc.priceInstallment)}
            </p>
          </div>
        )}

        {/* === ADMIN VIEW === */}
        {isAdmin && (
          <div className="space-y-1">
            <p className="text-xs text-gray-400 line-through">
              Custo: {formatBRL(priceCalc.cost)}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-extrabold text-brand-500">
                {formatBRL(priceCalc.priceCard)}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                +{priceCalc.appliedMargin}%{hasOverride ? " *" : ""}
              </span>
            </div>
            <div className="text-[11px] text-gray-400 space-y-0.5">
              <p>PIX: {formatBRL(priceCalc.pricePix)} | Parc: {formatBRL(priceCalc.priceInstallment)}</p>
              <p>
                Lucro: {formatBRL(priceCalc.netProfit)} | Margem: {priceCalc.netMargin.toFixed(1)}%
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
