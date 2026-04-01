"use client";

import { useState, useMemo } from "react";
import { useCatalog } from "@/context/CatalogContext";
import { PRODUCTS } from "@/data/products";
import { calcProduct, formatBRL } from "@/lib/pricing";
import { CATEGORY_LABELS } from "@/lib/types";

export function ProductOverridesTab() {
  const { globalSettings, overrides, setOverride, removeOverride } = useCatalog();
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMargin, setEditMargin] = useState(0);
  const [editShipping, setEditShipping] = useState(0);
  const [showOnlyOverrides, setShowOnlyOverrides] = useState(false);

  const products = useMemo(() => {
    let list = PRODUCTS.filter((p) => !p.soldOut);
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    if (showOnlyOverrides) {
      list = list.filter((p) => overrides[p.id]);
    }
    return list;
  }, [filter, showOnlyOverrides, overrides]);

  const overrideCount = Object.keys(overrides).length;

  const startEdit = (productId: number) => {
    const ov = overrides[productId];
    setEditMargin(ov?.margin ?? globalSettings.margin);
    setEditShipping(ov?.shipping ?? globalSettings.shipping);
    setEditingId(productId);
  };

  const saveEdit = () => {
    if (editingId === null) return;
    setOverride(editingId, { margin: editMargin, shipping: editShipping });
    setEditingId(null);
  };

  const resetAll = () => {
    if (!confirm(`Resetar ${overrideCount} override(s) para valores globais?`)) return;
    Object.keys(overrides).forEach((id) => removeOverride(Number(id)));
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          type="text"
          placeholder="Buscar produto..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input-field text-sm py-2 flex-1"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setShowOnlyOverrides(!showOnlyOverrides)}
            className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              showOnlyOverrides
                ? "bg-brand-400 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            Personalizados ({overrideCount})
          </button>
          {overrideCount > 0 && (
            <button
              onClick={resetAll}
              className="text-xs font-semibold px-3 py-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors whitespace-nowrap"
            >
              Resetar Todos
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Global: margem {globalSettings.margin}% | frete {formatBRL(globalSettings.shipping)} | {products.length} produtos
      </p>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-3 py-2.5">Produto</th>
              <th className="text-left px-3 py-2.5">Categoria</th>
              <th className="text-right px-3 py-2.5">Custo</th>
              <th className="text-right px-3 py-2.5">Margem</th>
              <th className="text-right px-3 py-2.5">Frete</th>
              <th className="text-right px-3 py-2.5">Cartao</th>
              <th className="text-right px-3 py-2.5">PIX</th>
              <th className="text-right px-3 py-2.5">Lucro</th>
              <th className="text-center px-3 py-2.5 w-28">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((p) => {
              const ov = overrides[p.id];
              const calc = calcProduct(p, globalSettings, ov);
              const isEditing = editingId === p.id;
              const hasOverride = !!ov;

              return (
                <tr
                  key={p.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    hasOverride ? "bg-brand-400/5" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-semibold text-gray-800 max-w-[200px] truncate">
                    {hasOverride && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-400 mr-1.5 align-middle" />
                    )}
                    {p.name}
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs">
                    {CATEGORY_LABELS[p.category]}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {formatBRL(p.cost)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editMargin}
                        onChange={(e) => setEditMargin(Number(e.target.value))}
                        className="w-16 px-1 py-0.5 text-right border rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className={hasOverride ? "text-brand-500 font-bold" : "text-gray-600"}>
                        {calc.appliedMargin}%
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editShipping}
                        onChange={(e) => setEditShipping(Number(e.target.value))}
                        className="w-16 px-1 py-0.5 text-right border rounded text-sm"
                        step={0.5}
                      />
                    ) : (
                      <span className={hasOverride ? "text-brand-500 font-bold" : "text-gray-600"}>
                        {formatBRL(calc.shipping)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatBRL(calc.priceCard)}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-600 font-semibold">
                    {formatBRL(calc.pricePix)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={calc.netProfit >= 0 ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>
                      {formatBRL(calc.netProfit)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {isEditing ? (
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={saveEdit}
                          className="text-xs px-2 py-1 bg-emerald-500 text-white rounded font-semibold hover:bg-emerald-600"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => startEdit(p.id)}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded hover:bg-gray-200"
                          title="Editar"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {hasOverride && (
                          <button
                            onClick={() => removeOverride(p.id)}
                            className="text-xs px-2 py-1 bg-red-50 text-red-400 rounded hover:bg-red-100"
                            title="Resetar para global"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {products.map((p) => {
          const ov = overrides[p.id];
          const calc = calcProduct(p, globalSettings, ov);
          const hasOverride = !!ov;
          const isEditing = editingId === p.id;

          return (
            <div
              key={p.id}
              className={`rounded-xl p-3 border ${
                hasOverride ? "border-brand-300 bg-brand-400/5" : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {hasOverride && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-400 mr-1" />
                    )}
                    {p.name}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {CATEGORY_LABELS[p.category]} | Custo: {formatBRL(p.cost)}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {isEditing ? (
                    <button onClick={saveEdit} className="text-xs px-2 py-1 bg-emerald-500 text-white rounded font-semibold">
                      Salvar
                    </button>
                  ) : (
                    <button onClick={() => startEdit(p.id)} className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded">
                      Editar
                    </button>
                  )}
                  {hasOverride && !isEditing && (
                    <button onClick={() => removeOverride(p.id)} className="text-xs px-2 py-1 bg-red-50 text-red-400 rounded">
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="text-[10px] text-gray-400">Margem %</label>
                    <input
                      type="number"
                      value={editMargin}
                      onChange={(e) => setEditMargin(Number(e.target.value))}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400">Frete R$</label>
                    <input
                      type="number"
                      value={editShipping}
                      onChange={(e) => setEditShipping(Number(e.target.value))}
                      className="w-full px-2 py-1 border rounded text-sm"
                      step={0.5}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 mt-1.5 text-xs">
                  <span className={hasOverride ? "text-brand-500 font-bold" : "text-gray-500"}>
                    {calc.appliedMargin}%
                  </span>
                  <span className="text-gray-700 font-semibold">
                    Cartao {formatBRL(calc.priceCard)}
                  </span>
                  <span className="text-emerald-600 font-semibold">
                    PIX {formatBRL(calc.pricePix)}
                  </span>
                  <span className={`font-semibold ${calc.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    Lucro {formatBRL(calc.netProfit)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
