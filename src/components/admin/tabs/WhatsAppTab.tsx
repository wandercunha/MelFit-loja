"use client";

import { useCatalog } from "@/context/CatalogContext";

export function WhatsAppTab() {
  const { globalSettings, setGlobalSettings } = useCatalog();

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
            value={globalSettings.whatsappNumber}
            onChange={(e) =>
              setGlobalSettings({
                ...globalSettings,
                whatsappNumber: e.target.value.replace(/\D/g, ""),
              })
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
            value={globalSettings.whatsappGreeting}
            onChange={(e) =>
              setGlobalSettings({
                ...globalSettings,
                whatsappGreeting: e.target.value,
              })
            }
            rows={4}
            className="input-field text-sm"
            placeholder="Ola! Gostaria de comprar essas pecas..."
          />
          <p className="text-xs text-gray-400 mt-1">
            Texto que aparece no inicio da mensagem enviada pelo cliente
          </p>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <h4 className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">
          Pre-visualizacao
        </h4>
        <div className="bg-white rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap border">
          {globalSettings.whatsappGreeting || "(mensagem vazia)"}
          {"\n\n"}*Pedido MF-XXXX*{"\n"}Cliente: Nome do Cliente{"\n\n"}*Itens:*{"\n"}
          1. Top Curve Cinza - Tam: M - Qtd: 1 - R$ 75,00{"\n\n"}
          *Forma de pagamento:* PIX{"\n"}*Total: R$ 72,00*
        </div>
      </div>
    </div>
  );
}
