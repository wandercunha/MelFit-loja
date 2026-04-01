"use client";

import { useState } from "react";
import { useCatalog } from "@/context/CatalogContext";

export function MarginsTab() {
  const { globalSettings, setGlobalSettings, overrides } = useCatalog();
  const [draft, setDraft] = useState({
    margin: globalSettings.margin,
    shipping: globalSettings.shipping,
  });
  const [saved, setSaved] = useState(false);

  const hasChanges = draft.margin !== globalSettings.margin || draft.shipping !== globalSettings.shipping;
  const overrideCount = Object.keys(overrides).length;

  const handleSave = () => {
    if (overrideCount > 0) {
      const apply = confirm(
        `Voce tem ${overrideCount} produto(s) com margem individual.\n\n` +
        `Deseja manter as margens individuais ou aplicar a nova configuração global para TODOS os produtos?\n\n` +
        `OK = Manter individuais (só novos produtos usam o valor global)\n` +
        `Cancelar = Não salvar`
      );
      if (!apply) return;
    }
    setGlobalSettings({ ...globalSettings, margin: draft.margin, shipping: draft.shipping });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDiscard = () => {
    setDraft({ margin: globalSettings.margin, shipping: globalSettings.shipping });
  };

  return (
    <div className="space-y-6 max-w-lg">
      <p className="text-sm text-gray-500">
        Configure a margem de lucro e o frete que serão aplicados a todos os produtos.
        Você pode sobrescrever valores individuais na aba Produtos.
      </p>

      <div className="bg-gray-50 rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Margem de Lucro Global (%)
          </label>
          <input
            type="number"
            value={draft.margin}
            onChange={(e) => setDraft({ ...draft, margin: Number(e.target.value) })}
            min={0}
            max={500}
            className="input-field text-lg font-bold"
          />
          <p className="text-xs text-gray-400 mt-1">
            Percentual sobre o custo do produto. Ex: 50% sobre R$50 = venda a R$75
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Frete por Peça (R$)
          </label>
          <input
            type="number"
            value={draft.shipping}
            onChange={(e) => setDraft({ ...draft, shipping: Number(e.target.value) })}
            min={0}
            step={0.5}
            className="input-field text-lg font-bold"
          />
          <p className="text-xs text-gray-400 mt-1">
            Valor de frete rateado por peça. Soma ao custo para cálculo do lucro líquido.
          </p>
        </div>
      </div>

      {/* Save bar */}
      {hasChanges && (
        <div className="flex gap-3 items-center bg-amber-50 border border-amber-200 rounded-xl p-4">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-amber-700 flex-1">
            Alterações não salvas
          </p>
          <button
            onClick={handleDiscard}
            className="text-xs font-semibold px-3 py-1.5 text-gray-500 bg-white rounded-lg border hover:bg-gray-50"
          >
            Descartar
          </button>
          <button
            onClick={handleSave}
            className="text-xs font-semibold px-4 py-1.5 bg-brand-400 text-white rounded-lg hover:bg-brand-500"
          >
            Salvar
          </button>
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Configuracoes salvas!
        </div>
      )}
    </div>
  );
}
