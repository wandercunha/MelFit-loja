"use client";

import { useCatalog } from "@/context/CatalogContext";
import { PRODUCTS } from "@/data/products";
import { calcProduct, formatBRL } from "@/lib/pricing";
import { ExportButton } from "./ExportButton";
import { PriceHistory } from "./PriceHistory";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdminPanel({ open, onClose }: Props) {
  const { globalSettings, setGlobalSettings, overrides } = useCatalog();

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

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />

      <aside className="fixed top-0 right-0 w-full sm:max-w-md h-full bg-white z-[70] shadow-2xl overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-brand-500">Configuracoes</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl"
            >
              &times;
            </button>
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-br from-brand-400 to-brand-500 text-white rounded-xl p-5 mb-6">
            <h3 className="font-bold text-sm uppercase tracking-wider mb-3 opacity-80">
              Resumo de Margem
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="opacity-80">Produtos disponiveis:</span>
                <span className="font-bold">{available.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-80">Com margem individual:</span>
                <span className="font-bold">{customCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-80">Custo total (c/ frete):</span>
                <span className="font-bold">{formatBRL(totalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-80">Venda total (cartao):</span>
                <span className="font-bold">{formatBRL(totalSell)}</span>
              </div>
              <div className="flex justify-between border-t border-white/20 pt-2">
                <span className="font-semibold">Lucro liquido total:</span>
                <span className="font-black text-lg">{formatBRL(totalProfit)}</span>
              </div>
            </div>
          </div>

          {/* Margem Global */}
          <section className="bg-gray-50 rounded-xl p-5 mb-4">
            <h3 className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-4">
              Margem de Lucro
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Porcentagem de Lucro (%)
                </label>
                <input
                  type="number"
                  value={globalSettings.margin}
                  onChange={(e) =>
                    setGlobalSettings({ ...globalSettings, margin: Number(e.target.value) })
                  }
                  min={0}
                  max={500}
                  className="input-field"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Aplicado a todos os produtos sem margem individual
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
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
                  className="input-field"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Valor de frete rateado por peca
                </p>
              </div>
            </div>
          </section>

          {/* Taxas de Pagamento */}
          <section className="bg-gray-50 rounded-xl p-5 mb-4">
            <h3 className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-4">
              Taxas de Pagamento
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
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
                <p className="text-[11px] text-gray-400 mt-1">
                  Desconto sobre o preco cartao a vista (padrao: 4%)
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Taxa Total Cartao Parcelado (%)
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
                <p className="text-[11px] text-gray-400 mt-1">
                  Taxa total do parcelamento (ex: 13.99% para 6x)
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Numero de Parcelas
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
                <p className="text-[11px] text-gray-400 mt-1">
                  Parcelas no cartao de credito (padrao: 6x)
                </p>
              </div>
            </div>
          </section>

          {/* WhatsApp */}
          <section className="bg-gray-50 rounded-xl p-5 mb-4">
            <h3 className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-4">
              WhatsApp / Checkout
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Numero WhatsApp (com DDI+DDD)
                </label>
                <input
                  type="text"
                  value={globalSettings.whatsappNumber}
                  onChange={(e) =>
                    setGlobalSettings({ ...globalSettings, whatsappNumber: e.target.value.replace(/\D/g, "") })
                  }
                  placeholder="5511982863050"
                  className="input-field"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Somente numeros, ex: 5511982863050
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Mensagem Inicial do Pedido
                </label>
                <textarea
                  value={globalSettings.whatsappGreeting}
                  onChange={(e) =>
                    setGlobalSettings({ ...globalSettings, whatsappGreeting: e.target.value })
                  }
                  rows={3}
                  className="input-field text-sm"
                  placeholder="Ola! Gostaria de comprar essas pecas..."
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Texto que aparece no inicio da mensagem do WhatsApp
                </p>
              </div>
            </div>
          </section>

          {/* Historico de Precos */}
          <PriceHistory />

          {/* Exemplo rapido */}
          <section className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">
              Exemplo Rapido (custo R$ 50)
            </h3>
            {(() => {
              const ex = 50 * (1 + globalSettings.margin / 100);
              const exPix = ex * (1 - globalSettings.pixDiscount / 100);
              const exParc = ex * (1 + globalSettings.cardRate / 100);
              const exMensal = globalSettings.installments > 0 ? exParc / globalSettings.installments : 0;
              return (
                <div className="text-sm space-y-1">
                  <p>Cartao a vista: <strong>{formatBRL(ex)}</strong></p>
                  <p>PIX (-{globalSettings.pixDiscount}%): <strong className="text-emerald-600">{formatBRL(exPix)}</strong></p>
                  <p>Parcelado {globalSettings.installments}x: <strong className="text-brand-500">{formatBRL(exMensal)}/mes</strong> (total {formatBRL(exParc)})</p>
                </div>
              );
            })()}
          </section>

          {/* Actions */}
          <section className="space-y-3">
            <ExportButton />
            <button
              onClick={() => window.print()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Imprimir / PDF
            </button>
          </section>
        </div>
      </aside>
    </>
  );
}
