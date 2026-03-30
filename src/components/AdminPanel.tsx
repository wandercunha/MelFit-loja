"use client";

import { useCatalog } from "@/context/CatalogContext";
import { PRODUCTS } from "@/data/products";
import { calcProduct, formatBRL } from "@/lib/pricing";
import { ExportButton } from "./ExportButton";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdminPanel({ open, onClose }: Props) {
  const { globalSettings, setGlobalSettings, overrides } = useCatalog();

  const available = PRODUCTS.filter((p) => !p.soldOut);
  let totalCost = 0;
  let totalSell = 0;
  let totalProfit = 0;
  available.forEach((p) => {
    const c = calcProduct(p, globalSettings, overrides[p.id]);
    totalCost += c.totalCost;
    totalSell += c.sellPrice;
    totalProfit += c.netProfit;
  });

  const customCount = Object.keys(overrides).length;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-[60]"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="fixed top-0 right-0 w-full max-w-md h-full bg-white z-[70] shadow-2xl overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-brand-500">Configurações</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl"
            >
              &times;
            </button>
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-br from-brand-400 to-brand-500 text-white rounded-xl p-5 mb-6">
            <h3 className="font-bold text-sm uppercase tracking-wider mb-3 opacity-80">
              Resumo de Margem
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="opacity-80">Produtos disponíveis:</span>
                <span className="font-bold">{available.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-80">Com margem individual:</span>
                <span className="font-bold">{customCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-80">Custo total estimado:</span>
                <span className="font-bold">{formatBRL(totalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-80">Venda total estimada:</span>
                <span className="font-bold">{formatBRL(totalSell)}</span>
              </div>
              <div className="flex justify-between border-t border-white/20 pt-2">
                <span className="font-semibold">Lucro líquido total:</span>
                <span className="font-black text-lg">{formatBRL(totalProfit)}</span>
              </div>
            </div>
          </div>

          {/* Global Margin */}
          <section className="bg-gray-50 rounded-xl p-5 mb-4">
            <h3 className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-4">
              Margem Global
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Porcentagem de Lucro (%)
                </label>
                <input
                  type="number"
                  value={globalSettings.margin}
                  onChange={(e) =>
                    setGlobalSettings({ ...globalSettings, margin: Number(e.target.value) })
                  }
                  min={0}
                  max={500}
                  className="input-field"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Aplicado a todos os produtos sem margem individual
                </p>
              </div>
            </div>
          </section>

          {/* Additional Costs */}
          <section className="bg-gray-50 rounded-xl p-5 mb-4">
            <h3 className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-4">
              Custos Adicionais (por peça)
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Frete por Peça (R$)
                </label>
                <input
                  type="number"
                  value={globalSettings.shipping}
                  onChange={(e) =>
                    setGlobalSettings({ ...globalSettings, shipping: Number(e.target.value) })
                  }
                  min={0}
                  step={0.5}
                  className="input-field"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Valor de frete rateado por peça
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Taxa de Parcelamento (%)
                </label>
                <input
                  type="number"
                  value={globalSettings.installment}
                  onChange={(e) =>
                    setGlobalSettings({ ...globalSettings, installment: Number(e.target.value) })
                  }
                  min={0}
                  max={100}
                  step={0.1}
                  className="input-field"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Ex: 3.49% para 3x, 5.99% para 6x no cartão
                </p>
              </div>
            </div>
          </section>

          {/* Actions */}
          <section className="space-y-3">
            <ExportButton />
            <button
              onClick={() => window.print()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Imprimir / PDF
            </button>
          </section>
        </div>
      </aside>
    </>
  );
}
