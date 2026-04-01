"use client";

import { useState } from "react";
import { useCatalog } from "@/context/CatalogContext";

export function WhatsAppTab() {
  const { globalSettings, setGlobalSettings } = useCatalog();
  const [draft, setDraft] = useState({
    whatsappNumber: globalSettings.whatsappNumber,
    whatsappGreeting: globalSettings.whatsappGreeting,
  });
  const [saved, setSaved] = useState(false);

  const hasChanges =
    draft.whatsappNumber !== globalSettings.whatsappNumber ||
    draft.whatsappGreeting !== globalSettings.whatsappGreeting;

  const handleSave = () => {
    setGlobalSettings({ ...globalSettings, ...draft });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDiscard = () => {
    setDraft({
      whatsappNumber: globalSettings.whatsappNumber,
      whatsappGreeting: globalSettings.whatsappGreeting,
    });
  };

  return (
    <div className="space-y-6 max-w-lg">
      <p className="text-sm text-gray-500">
        Configure o numero e a mensagem padrao para pedidos via WhatsApp.
      </p>

      <div className="bg-gray-50 rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Numero do WhatsApp
          </label>
          <input
            type="text"
            value={draft.whatsappNumber}
            onChange={(e) =>
              setDraft({ ...draft, whatsappNumber: e.target.value.replace(/\D/g, "") })
            }
            placeholder="5511982863050"
            className="input-field"
          />
          <p className="text-xs text-gray-400 mt-1">
            Somente numeros com DDI + DDD. Ex: 5511982863050
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Mensagem Inicial do Pedido
          </label>
          <textarea
            value={draft.whatsappGreeting}
            onChange={(e) => setDraft({ ...draft, whatsappGreeting: e.target.value })}
            rows={4}
            className="input-field text-sm"
            placeholder="Ola! Gostaria de comprar essas pecas..."
          />
          <p className="text-xs text-gray-400 mt-1">
            Texto que aparece no inicio da mensagem enviada pelo cliente
          </p>
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
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <h4 className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">
          Pre-visualizacao da mensagem
        </h4>
        <div className="bg-white rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap border font-mono text-xs leading-relaxed">
          {draft.whatsappGreeting || "(mensagem vazia)"}
          {"\n\n"}*Pedido MF-XXXX*{"\n"}Cliente: Nome do Cliente{"\n\n"}*Itens:*{"\n"}
          1. Top Curve Cinza - Tam: M - Qtd: 1 - R$ 75,00{"\n\n"}
          *Forma de pagamento:* PIX{"\n"}*Total: R$ 72,00*
        </div>
      </div>
    </div>
  );
}
