"use client";

import { useCatalog } from "@/context/CatalogContext";
import { useCatalogData } from "@/context/CatalogDataContext";
import { PRODUCTS } from "@/data/products";
import { calcProduct, formatBRL } from "@/lib/pricing";
import { ExportButton } from "@/components/ExportButton";

export function DashboardTab() {
  const { globalSettings, overrides, categoryOverrides, isProductVisible } = useCatalog();
  const { updatedAt, dataSource } = useCatalogData();

  const available = PRODUCTS.filter((p) => isProductVisible(p.id, p.soldOut));

  // Alerta se scrape não rodou há mais de 36h
  const hoursAgo = updatedAt ? (Date.now() - new Date(updatedAt).getTime()) / 3600000 : Infinity;
  const scrapeStale = hoursAgo > 36;
  let totalCost = 0;
  let totalSell = 0;
  let totalProfit = 0;
  available.forEach((p) => {
    const c = calcProduct(p, globalSettings, overrides[p.id], categoryOverrides[p.category]);
    totalCost += c.totalCost;
    totalSell += c.priceCard;
    totalProfit += c.netProfit;
  });

  const customCount = Object.keys(overrides).length;
  const ex = 50 * (1 + globalSettings.margin / 100);
  const exParc = ex * (1 + globalSettings.cardRate / 100);
  const exPix = exParc * (1 - globalSettings.pixDiscount / 100);
  const exMensal = globalSettings.installments > 0 ? exParc / globalSettings.installments : 0;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const tz = "America/Sao_Paulo";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: tz })
      + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  };

  return (
    <div className="space-y-6">
      {/* Scrape status */}
      {scrapeStale ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-700">Dados desatualizados</p>
            <p className="text-xs text-red-600 mt-0.5">
              {updatedAt
                ? `Ultimo scrape: ${formatDate(updatedAt)} (${Math.floor(hoursAgo)}h atras)`
                : "Nenhum scrape registrado"}
            </p>
            <p className="text-[11px] text-red-500 mt-1">
              Rode <code className="bg-red-100 px-1 rounded">npm run scrape:all</code> no seu computador
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs text-emerald-700">
            Dados atualizados{updatedAt ? ` em ${formatDate(updatedAt)}` : ""}
            <span className="text-emerald-500 ml-1">({dataSource === "turso" ? "banco" : "local"})</span>
          </p>
        </div>
      )}

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
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-[10px] text-brand-400 uppercase">{globalSettings.installments}x sem juros</p>
            <p className="font-bold text-brand-500">{formatBRL(exMensal)}/mes</p>
            <p className="text-[9px] text-gray-400 mt-0.5">total {formatBRL(exParc)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-[10px] text-emerald-500 uppercase">PIX (-{globalSettings.pixDiscount}%)</p>
            <p className="font-bold text-emerald-600">{formatBRL(exPix)}</p>
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
