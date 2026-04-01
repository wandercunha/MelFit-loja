"use client";

import { useCatalog } from "@/context/CatalogContext";
import { PRODUCTS } from "@/data/products";
import { calcProduct, formatBRL } from "@/lib/pricing";
import { ExportButton } from "@/components/ExportButton";

export function DashboardTab() {
  const { globalSettings, overrides } = useCatalog();

  const available = PRODUCTS.filter((p) => !p.soldOut);
  let totalCost = 0;
  let totalSell = 0;
  let totalProfit = 0;
  available.forEach((p) => {
    const c = calcProduct(p, globalSettings, overrides[p.id]);
    totalCost += c.totalCost;
    totalSell += c.priceCard;
    totalProfit += c.netProfit;
  });

  const customCount = Object.keys(overrides).length;
  const ex = 50 * (1 + globalSettings.margin / 100);
  const exPix = ex * (1 - globalSettings.pixDiscount / 100);
  const exParc = ex * (1 + globalSettings.cardRate / 100);
  const exMensal = globalSettings.installments > 0 ? exParc / globalSettings.installments : 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-br from-brand-400 to-brand-500 text-white rounded-xl p-5">
        <h3 className="font-bold text-sm uppercase tracking-wider mb-3 opacity-80">
          Resumo de Margem
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs opacity-70">Produtos</p>
            <p className="text-xl font-black">{available.length}</p>
          </div>
          <div>
            <p className="text-xs opacity-70">Com margem individual</p>
            <p className="text-xl font-black">{customCount}</p>
          </div>
          <div>
            <p className="text-xs opacity-70">Custo total (c/ frete)</p>
            <p className="text-lg font-bold">{formatBRL(totalCost)}</p>
          </div>
          <div>
            <p className="text-xs opacity-70">Venda total (cartao)</p>
            <p className="text-lg font-bold">{formatBRL(totalSell)}</p>
          </div>
        </div>
        <div className="border-t border-white/20 pt-3 mt-3 flex justify-between items-center">
          <span className="font-semibold">Lucro liquido total:</span>
          <span className="font-black text-2xl">{formatBRL(totalProfit)}</span>
        </div>
      </div>

      {/* Quick example */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">
          Simulacao Rapida (custo R$ 50)
        </h4>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-[10px] text-gray-400 uppercase">Cartao</p>
            <p className="font-bold text-gray-700">{formatBRL(ex)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-[10px] text-emerald-500 uppercase">PIX (-{globalSettings.pixDiscount}%)</p>
            <p className="font-bold text-emerald-600">{formatBRL(exPix)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-[10px] text-brand-400 uppercase">{globalSettings.installments}x</p>
            <p className="font-bold text-brand-500">{formatBRL(exMensal)}/mes</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <ExportButton />
        <button
          onClick={() => window.print()}
          className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-sm"
        >
          Imprimir / PDF
        </button>
      </div>
    </div>
  );
}
