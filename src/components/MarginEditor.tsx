"use client";

import { Product } from "@/lib/types";
import { useCatalog } from "@/context/CatalogContext";
import { useState, useEffect } from "react";
import { formatBRL } from "@/lib/pricing";

interface Props {
  product: Product;
  onClose: () => void;
}

export function MarginEditor({ product, onClose }: Props) {
  const { globalSettings, overrides, setOverride, removeOverride } = useCatalog();
  const existing = overrides[product.id];

  const [margin, setMargin] = useState(existing?.margin ?? globalSettings.margin);
  const [shipping, setShipping] = useState(existing?.shipping ?? globalSettings.shipping);

  useEffect(() => {
    setMargin(existing?.margin ?? globalSettings.margin);
    setShipping(existing?.shipping ?? globalSettings.shipping);
  }, [product.id, existing, globalSettings]);

  // Usar taxa/desconto globais
  const { cardRate, pixDiscount, installments } = globalSettings;

  const cost = product.cost;
  const totalCost = cost + shipping;
  const priceCard = cost * (1 + margin / 100);
  const pricePix = priceCard * (1 - pixDiscount / 100);
  const priceInstallment = priceCard * (1 + cardRate / 100);
  const installmentMonthly = installments > 0 ? priceInstallment / installments : 0;
  const netProfit = priceCard - totalCost;
  const netMargin = priceCard > 0 ? (netProfit / priceCard) * 100 : 0;

  const handleSave = () => {
    setOverride(product.id, { margin, shipping });
    onClose();
  };

  const handleReset = () => {
    removeOverride(product.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-lg font-bold text-brand-500 mb-1">{product.name}</h3>
        <a
          href={`https://www.floraamaratacado.com.br/${product.slug || product.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+c\/\s*/g, "-c-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700 hover:underline mb-5"
        >
          Ver no site do fabricante
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Custo (R$)
            </label>
            <input
              type="number"
              value={cost.toFixed(2)}
              readOnly
              className="input-field bg-gray-50 text-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Margem (%)
            </label>
            <input
              type="number"
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              min={0}
              max={500}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Frete (R$)
            </label>
            <input
              type="number"
              value={shipping}
              onChange={(e) => setShipping(Number(e.target.value))}
              min={0}
              step={0.5}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Taxa Cartao ({installments}x)
            </label>
            <input
              type="text"
              value={`${cardRate}%`}
              readOnly
              className="input-field bg-gray-50 text-gray-400"
            />
            <p className="text-[10px] text-gray-400 mt-1">Config. global</p>
          </div>
        </div>

        {/* Result Preview */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-4 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Custo do produto:</span>
            <span>{formatBRL(cost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">+ Frete:</span>
            <span>{formatBRL(shipping)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-1.5">
            <span className="text-gray-600">= Custo total:</span>
            <span>{formatBRL(totalCost)}</span>
          </div>
        </div>

        {/* Prices Preview */}
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mb-5 space-y-2">
          <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Precos de Venda</h4>

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Cartao a vista:</span>
            <span className="font-bold">{formatBRL(priceCard)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">PIX (-{pixDiscount}%):</span>
            <span className="font-bold text-emerald-600">{formatBRL(pricePix)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Parcelado {installments}x (+{cardRate}%):</span>
            <span className="font-bold text-brand-500">{formatBRL(priceInstallment)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Parcela mensal:</span>
            <span className="font-semibold">{formatBRL(installmentMonthly)}/mes</span>
          </div>

          <div className="border-t-2 border-emerald-300 pt-2 mt-2">
            <div className="flex justify-between text-base font-bold">
              <span>Lucro liquido (cartao):</span>
              <span className={netProfit >= 0 ? "text-emerald-600" : "text-red-600"}>
                {formatBRL(netProfit)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-emerald-600">
              <span>Margem liquida:</span>
              <span>{netMargin.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          {existing && (
            <button
              onClick={handleReset}
              className="px-4 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Usar Global
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button onClick={handleSave} className="flex-1 btn-primary">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
