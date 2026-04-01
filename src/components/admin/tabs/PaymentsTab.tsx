"use client";

import { useState } from "react";
import { useCatalog } from "@/context/CatalogContext";
import { formatBRL } from "@/lib/pricing";

export function PaymentsTab() {
  const { globalSettings, setGlobalSettings } = useCatalog();
  const [draft, setDraft] = useState({
    pixDiscount: globalSettings.pixDiscount,
    cardRate: globalSettings.cardRate,
    installments: globalSettings.installments,
  });
  const [saved, setSaved] = useState(false);

  const hasChanges =
    draft.pixDiscount !== globalSettings.pixDiscount ||
    draft.cardRate !== globalSettings.cardRate ||
    draft.installments !== globalSettings.installments;

  const handleSave = () => {
    setGlobalSettings({ ...globalSettings, ...draft });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDiscard = () => {
    setDraft({
      pixDiscount: globalSettings.pixDiscount,
      cardRate: globalSettings.cardRate,
      installments: globalSettings.installments,
    });
  };

  // Preview with draft values
  const ex = 100 * (1 + globalSettings.margin / 100);
  const exPix = ex * (1 - draft.pixDiscount / 100);
  const exParc = ex * (1 + draft.cardRate / 100);
  const exMensal = draft.installments > 0 ? exParc / draft.installments : 0;

  return (
    <div className="space-y-6 max-w-lg">
      <p className="text-sm text-gray-500">
        Configure as taxas e descontos por forma de pagamento.
      </p>

      <div className="bg-gray-50 rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Desconto PIX (%)
          </label>
          <input
            type="number"
            value={draft.pixDiscount}
            onChange={(e) => setDraft({ ...draft, pixDiscount: Number(e.target.value) })}
            min={0}
            max={50}
            step={0.5}
            className="input-field"
          />
          <p className="text-xs text-gray-400 mt-1">
            Desconto sobre o preco de cartao a vista para pagamento via PIX
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Taxa Total do Parcelamento (%)
          </label>
          <input
            type="number"
            value={draft.cardRate}
            onChange={(e) => setDraft({ ...draft, cardRate: Number(e.target.value) })}
            min={0}
            max={100}
            step={0.01}
            className="input-field"
          />
          <p className="text-xs text-gray-400 mt-1">
            Taxa total para o parcelamento maximo (ex: 13.99% para {draft.installments}x)
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Numero Maximo de Parcelas
          </label>
          <input
            type="number"
            value={draft.installments}
            onChange={(e) => setDraft({ ...draft, installments: Number(e.target.value) })}
            min={1}
            max={12}
            className="input-field"
          />
        </div>
      </div>

      {/* Save bar */}
      {hasChanges && (
        <div className="flex gap-3 items-center bg-amber-50 border border-amber-200 rounded-xl p-4">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-amber-700 flex-1">Alteracoes nao salvas</p>
          <button onClick={handleDiscard} className="text-xs font-semibold px-3 py-1.5 text-gray-500 bg-white rounded-lg border hover:bg-gray-50">
            Descartar
          </button>
          <button onClick={handleSave} className="text-xs font-semibold px-4 py-1.5 bg-brand-400 text-white rounded-lg hover:bg-brand-500">
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

      {/* Preview */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">
          Simulacao (produto custo R$ 100, margem {globalSettings.margin}%)
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Cartao a vista:</span>
            <span className="font-bold">{formatBRL(ex)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-emerald-600">PIX (-{draft.pixDiscount}%):</span>
            <span className="font-bold text-emerald-600">{formatBRL(exPix)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-500">Parcelado {draft.installments}x (+{draft.cardRate}%):</span>
            <span className="font-bold text-brand-500">{formatBRL(exMensal)}/mes</span>
          </div>
          <div className="flex justify-between text-gray-400 text-xs">
            <span>Total parcelado:</span>
            <span>{formatBRL(exParc)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
