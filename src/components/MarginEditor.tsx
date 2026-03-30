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
  const [installment, setInstallment] = useState(existing?.installment ?? globalSettings.installment);

  useEffect(() => {
    setMargin(existing?.margin ?? globalSettings.margin);
    setShipping(existing?.shipping ?? globalSettings.shipping);
    setInstallment(existing?.installment ?? globalSettings.installment);
  }, [product.id, existing, globalSettings]);

  const cost = product.cost;
  const totalCost = cost + shipping;
  const sellPrice = cost * (1 + margin / 100);
  const installmentFee = sellPrice * (installment / 100);
  const netProfit = sellPrice - totalCost - installmentFee;
  const netMargin = sellPrice > 0 ? (netProfit / sellPrice) * 100 : 0;

  const handleSave = () => {
    setOverride(product.id, { margin, shipping, installment });
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
        className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl"
      >
        <h3 className="text-lg font-bold text-brand-500 mb-1">{product.name}</h3>
        <p className="text-sm text-gray-400 mb-5">Editar margem individual</p>

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
              Taxa Parcelamento (%)
            </label>
            <input
              type="number"
              value={installment}
              onChange={(e) => setInstallment(Number(e.target.value))}
              min={0}
              step={0.1}
              className="input-field"
            />
          </div>
        </div>

        {/* Result Preview */}
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mb-5 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Custo do produto:</span>
            <span>{formatBRL(cost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">+ Frete:</span>
            <span>{formatBRL(shipping)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">= Custo total:</span>
            <span className="font-semibold">{formatBRL(totalCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Preço de venda:</span>
            <span className="font-semibold">{formatBRL(sellPrice)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">- Taxa parcelamento:</span>
            <span className="text-red-500">- {formatBRL(installmentFee)}</span>
          </div>
          <div className="border-t-2 border-emerald-300 pt-2 mt-2">
            <div className="flex justify-between text-base font-bold">
              <span>Lucro líquido:</span>
              <span className={netProfit >= 0 ? "text-emerald-600" : "text-red-600"}>
                {formatBRL(netProfit)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-emerald-600">
              <span>Margem líquida:</span>
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
