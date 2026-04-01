"use client";

import { useCatalog } from "@/context/CatalogContext";

export function MarginsTab() {
  const { globalSettings, setGlobalSettings } = useCatalog();

  return (
    <div className="space-y-6 max-w-lg">
      <p className="text-sm text-gray-500">
        Configure a margem de lucro e o frete que serao aplicados a todos os produtos.
        Voce pode sobrescrever valores individuais na aba Produtos.
      </p>

      <div className="bg-gray-50 rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Margem de Lucro Global (%)
          </label>
          <input
            type="number"
            value={globalSettings.margin}
            onChange={(e) =>
              setGlobalSettings({ ...globalSettings, margin: Number(e.target.value) })
            }
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
            Frete por Peca (R$)
          </label>
          <input
            type="number"
            value={globalSettings.shipping}
            onChange={(e) =>
              setGlobalSettings({ ...globalSettings, shipping: Number(e.target.value) })
            }
            min={0}
            step={0.5}
            className="input-field text-lg font-bold"
          />
          <p className="text-xs text-gray-400 mt-1">
            Valor de frete rateado por peca. Soma ao custo para calculo do lucro liquido.
          </p>
        </div>
      </div>
    </div>
  );
}
