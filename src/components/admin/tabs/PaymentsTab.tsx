"use client";

import { useCatalog } from "@/context/CatalogContext";
import { formatBRL } from "@/lib/pricing";

export function PaymentsTab() {
  const { globalSettings, setGlobalSettings } = useCatalog();

  const ex = 100 * (1 + globalSettings.margin / 100);
  const exPix = ex * (1 - globalSettings.pixDiscount / 100);
  const exParc = ex * (1 + globalSettings.cardRate / 100);
  const exMensal = globalSettings.installments > 0 ? exParc / globalSettings.installments : 0;

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
            value={globalSettings.pixDiscount}
            onChange={(e) =>
              setGlobalSettings({ ...globalSettings, pixDiscount: Number(e.target.value) })
            }
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
            value={globalSettings.cardRate}
            onChange={(e) =>
              setGlobalSettings({ ...globalSettings, cardRate: Number(e.target.value) })
            }
            min={0}
            max={100}
            step={0.01}
            className="input-field"
          />
          <p className="text-xs text-gray-400 mt-1">
            Taxa total para o parcelamento maximo (ex: 13.99% para {globalSettings.installments}x)
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Numero Maximo de Parcelas
          </label>
          <input
            type="number"
            value={globalSettings.installments}
            onChange={(e) =>
              setGlobalSettings({ ...globalSettings, installments: Number(e.target.value) })
            }
            min={1}
            max={12}
            className="input-field"
          />
        </div>
      </div>

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
            <span className="text-emerald-600">PIX (-{globalSettings.pixDiscount}%):</span>
            <span className="font-bold text-emerald-600">{formatBRL(exPix)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-500">Parcelado {globalSettings.installments}x (+{globalSettings.cardRate}%):</span>
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
