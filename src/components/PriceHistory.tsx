"use client";

import { useState, useEffect } from "react";
import { formatBRL } from "@/lib/pricing";
import { useCatalog } from "@/context/CatalogContext";

interface PriceChange {
  date: string;
  product: string;
  slug: string;
  field: string;
  oldValue: number | string;
  newValue: number | string;
}

interface Snapshot {
  date: string;
  productCount: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
}

interface HistoryData {
  lastUpdate: string | null;
  totalChanges: number;
  changes: PriceChange[];
  snapshots: Snapshot[];
}

export function PriceHistory({ defaultExpanded = false }: { defaultExpanded?: boolean } = {}) {
  const { apiSecret } = useCatalog();
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/history?secret=${apiSecret}&days=${days}`);
      if (!res.ok) throw new Error("Erro ao buscar historico");
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (expanded) load();
  }, [expanded, days]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <section className="bg-gray-50 rounded-xl p-5 mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <h3 className="text-xs font-bold text-brand-500 uppercase tracking-widest">
          Historico de Precos
        </h3>
        <span className="text-gray-400 text-sm">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Period filter */}
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  days === d
                    ? "bg-brand-400 text-white"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {loading && (
            <p className="text-sm text-gray-400 animate-pulse">Carregando...</p>
          )}

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {data && !loading && (
            <>
              {/* Last update */}
              {data.lastUpdate && (
                <p className="text-[11px] text-gray-400">
                  Ultima atualizacao: {formatDate(data.lastUpdate)}
                </p>
              )}

              {/* Snapshot chart (simplified text-based) */}
              {data.snapshots.length > 0 && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <h4 className="text-[11px] font-bold text-gray-500 uppercase mb-2">
                    Evolucao de Precos (Varejo)
                  </h4>
                  <div className="space-y-1">
                    {data.snapshots.slice(-7).map((s, i) => {
                      const date = new Date(s.date).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      });
                      const barWidth = Math.round(
                        ((s.avgPrice - (data.snapshots.reduce((m, x) => Math.min(m, x.avgPrice), Infinity))) /
                          (data.snapshots.reduce((m, x) => Math.max(m, x.avgPrice), 0) -
                            data.snapshots.reduce((m, x) => Math.min(m, x.avgPrice), Infinity) || 1)) *
                          100
                      );
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="text-gray-400 w-12 shrink-0">{date}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-brand-400 to-brand-300 h-full rounded-full transition-all"
                              style={{ width: `${Math.max(20, barWidth)}%` }}
                            />
                          </div>
                          <span className="text-gray-600 font-semibold w-16 text-right shrink-0">
                            {formatBRL(s.avgPrice)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Media de precos do site de varejo (ultimos {Math.min(7, data.snapshots.length)} registros)
                  </p>
                </div>
              )}

              {/* Price changes */}
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <h4 className="text-[11px] font-bold text-gray-500 uppercase mb-2">
                  Alteracoes Detectadas ({data.changes.length})
                </h4>

                {data.changes.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">
                    Nenhuma alteracao de preco nos ultimos {days} dias
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {[...data.changes].reverse().map((c, i) => {
                      const oldVal = typeof c.oldValue === "number" ? c.oldValue : parseFloat(String(c.oldValue));
                      const newVal = typeof c.newValue === "number" ? c.newValue : parseFloat(String(c.newValue));
                      const pct = oldVal > 0 ? ((newVal - oldVal) / oldVal) * 100 : 0;
                      const isUp = newVal > oldVal;

                      return (
                        <div
                          key={i}
                          className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                            isUp ? "bg-red-50" : "bg-green-50"
                          }`}
                        >
                          <span className={`text-lg leading-none ${isUp ? "text-red-500" : "text-green-500"}`}>
                            {isUp ? "↑" : "↓"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-700 truncate">
                              {c.product}
                            </p>
                            <p className="text-gray-500">
                              {formatBRL(oldVal)} → {formatBRL(newVal)}{" "}
                              <span className={`font-bold ${isUp ? "text-red-600" : "text-green-600"}`}>
                                ({pct > 0 ? "+" : ""}{pct.toFixed(1)}%)
                              </span>
                            </p>
                            <p className="text-gray-400 text-[10px]">
                              {formatDate(c.date)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Summary stats */}
              {data.snapshots.length > 1 && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  {(() => {
                    const first = data.snapshots[0];
                    const last = data.snapshots[data.snapshots.length - 1];
                    const priceDiff = last.avgPrice - first.avgPrice;
                    const pricePct = (priceDiff / first.avgPrice) * 100;
                    return (
                      <>
                        <div className="bg-white rounded-lg p-2 border border-gray-200">
                          <p className="text-[10px] text-gray-400 uppercase">Min</p>
                          <p className="text-sm font-bold text-gray-700">
                            {formatBRL(last.minPrice)}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-2 border border-gray-200">
                          <p className="text-[10px] text-gray-400 uppercase">Media</p>
                          <p className="text-sm font-bold text-gray-700">
                            {formatBRL(last.avgPrice)}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-2 border border-gray-200">
                          <p className="text-[10px] text-gray-400 uppercase">Variacao</p>
                          <p className={`text-sm font-bold ${priceDiff >= 0 ? "text-red-600" : "text-green-600"}`}>
                            {priceDiff >= 0 ? "+" : ""}{pricePct.toFixed(1)}%
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Manual refresh */}
              <button
                onClick={load}
                className="w-full py-2 text-xs font-semibold text-brand-500 hover:bg-brand-400/10 rounded-lg transition-colors"
              >
                Atualizar Historico
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
