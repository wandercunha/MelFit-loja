"use client";

import { useCart } from "@/context/CartContext";
import { useCatalog } from "@/context/CatalogContext";
import { useCatalogData } from "@/context/CatalogDataContext";
import { calcProduct, formatBRL } from "@/lib/pricing";
import { PaymentMethod, PAYMENT_LABELS } from "@/lib/types";
import { useState, useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: Props) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);
  const { items, customer, cartId, removeItem, updateQuantity, clearCart, setCustomer } =
    useCart();
  const { globalSettings, overrides, categoryOverrides } = useCatalog();
  const { allProducts } = useCatalogData();
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [selectedInstallments, setSelectedInstallments] = useState(globalSettings.installments);
  const [showCheckout, setShowCheckout] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const maxInstallments = globalSettings.installments;

  const getPrice = (productId: number) => {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return { pricePix: 0, priceCard: 0, priceInstallment: 0, installmentMonthly: 0, installments: 6, cardRate: 0 };
    return calcProduct(product, globalSettings, overrides[productId], categoryOverrides[product.category]);
  };

  const getUnitPrice = (productId: number) => {
    const calc = getPrice(productId);
    if (payment === "pix") return Math.round(calc.pricePix);
    // Cartão: total com taxa embutida (mesmo total 1x ou 6x)
    return Math.round(calc.priceInstallment);
  };

  const subtotal = items.reduce(
    (sum, item) => sum + getUnitPrice(item.productId) * item.quantity,
    0
  );

  const installmentMonthly = payment === "credito_parcelado" && selectedInstallments > 0
    ? subtotal / selectedInstallments
    : 0;

  const buildWhatsAppMessage = () => {
    const lines: string[] = [];
    lines.push(globalSettings.whatsappGreeting);
    lines.push(``);
    lines.push(`*Pedido ${cartId}*`);
    if (customer.name) lines.push(`Cliente: ${customer.name}`);
    if (customer.email) lines.push(`Email: ${customer.email}`);
    if (customer.phone) lines.push(`Tel: ${customer.phone}`);
    lines.push(``);
    lines.push(`*Itens:*`);

    items.forEach((item, i) => {
      const price = getUnitPrice(item.productId);
      if (item.pieceSizes) {
        const sizes = item.pieceSizes.map((ps) => `${ps.name}: ${ps.size}`).join(" | ");
        lines.push(`${i + 1}. ${item.name}`);
        lines.push(`   ${sizes}`);
        lines.push(`   Qtd: ${item.quantity} - ${formatBRL(price * item.quantity)}`);
      } else {
        lines.push(`${i + 1}. ${item.name} - Tam: ${item.size} - Qtd: ${item.quantity} - ${formatBRL(price * item.quantity)}`);
      }
    });

    lines.push(``);
    lines.push(`*Forma de pagamento:* ${PAYMENT_LABELS[payment]}`);

    if (payment === "credito_parcelado") {
      lines.push(`Parcelas: ${selectedInstallments}x de ${formatBRL(Math.round(subtotal / selectedInstallments))} sem juros`);
    }

    lines.push(`*Total: ${formatBRL(subtotal)}*`);

    return encodeURIComponent(lines.join("\n"));
  };

  const whatsappUrl = `https://wa.me/${globalSettings.whatsappNumber}?text=${buildWhatsAppMessage()}`;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />

      <aside className="fixed top-0 right-0 w-full sm:max-w-md h-full bg-white z-[70] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Carrinho</h2>
            <p className="text-[10px] text-gray-400">ID: {cartId}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl"
          >
            &times;
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg
                className="w-16 h-16 mx-auto mb-3 opacity-30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                />
              </svg>
              <p className="font-semibold">Carrinho vazio</p>
              <p className="text-sm mt-1">Adicione produtos para comecar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const unitPrice = getUnitPrice(item.productId);
                return (
                  <div
                    key={`${item.productId}-${item.size}`}
                    className="flex gap-3 bg-gray-50 rounded-xl p-3"
                  >
                    {/* Thumb */}
                    <div className="w-16 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                      {item.img && (
                        <img
                          src={item.img}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {item.name}
                      </p>
                      {item.pieceSizes ? (
                        <div className="text-[10px] text-gray-400 space-y-0.5">
                          {item.pieceSizes.map((ps) => (
                            <p key={ps.name}>{ps.name}: <span className="font-bold text-gray-500">{ps.size}</span></p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">
                          Tam: {item.size}
                        </p>
                      )}
                      <p className="text-sm font-bold text-brand-500 mt-1">
                        {formatBRL(unitPrice * item.quantity)}
                      </p>

                      {/* Qty controls */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.productId,
                              item.size,
                              item.quantity - 1
                            )
                          }
                          className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xs font-bold"
                        >
                          -
                        </button>
                        <span className="text-sm font-semibold w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.productId,
                              item.size,
                              item.quantity + 1
                            )
                          }
                          className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xs font-bold"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(item.productId, item.size)}
                          className="ml-auto text-red-400 hover:text-red-600 text-xs"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer / Checkout */}
        {items.length > 0 && (
          <div className="border-t p-4 space-y-3 bg-gray-50">
            {!showCheckout ? (
              <>
                {/* Payment method */}
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">
                    Forma de pagamento
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      ["pix", "credito_parcelado"] as PaymentMethod[]
                    ).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPayment(m)}
                        className={`text-[10px] sm:text-xs font-semibold py-1.5 px-2 rounded-lg transition-colors ${
                          payment === m
                            ? "bg-brand-400 text-white"
                            : "bg-white text-gray-500 hover:bg-gray-100 border border-gray-200"
                        }`}
                      >
                        {PAYMENT_LABELS[m]}
                      </button>
                    ))}
                  </div>
                </div>

                {payment === "credito_parcelado" && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">
                      Parcelas
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          onClick={() => setSelectedInstallments(n)}
                          className={`text-xs font-semibold py-1 px-2.5 rounded-lg transition-colors ${
                            selectedInstallments === n
                              ? "bg-brand-400 text-white"
                              : "bg-white text-gray-500 hover:bg-gray-100 border border-gray-200"
                          }`}
                        >
                          {n}x
                        </button>
                      ))}
                    </div>
                    {selectedInstallments > 0 && (
                      <p className="text-xs text-brand-500 font-semibold mt-1">
                        {selectedInstallments}x de {formatBRL(Math.round(subtotal / selectedInstallments))} sem juros
                      </p>
                    )}
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total:</span>
                  <span className="text-xl font-black text-brand-500">
                    {formatBRL(subtotal)}
                  </span>
                </div>

                <button
                  onClick={() => setShowCheckout(true)}
                  className="w-full btn-primary py-3 text-base"
                >
                  Fechar Pedido
                </button>

                <button
                  onClick={clearCart}
                  className="w-full text-xs text-gray-400 hover:text-red-500 py-1"
                >
                  Limpar carrinho
                </button>
              </>
            ) : (
              <>
                {/* Customer info */}
                <p className="text-xs font-bold text-gray-500 uppercase">
                  Seus dados
                </p>
                <input
                  type="text"
                  placeholder="Seu nome *"
                  value={customer.name}
                  onChange={(e) => setCustomer({ name: e.target.value })}
                  className="input-field text-sm py-2"
                  required
                />
                <input
                  type="email"
                  placeholder="Email (para identificar pedido)"
                  value={customer.email}
                  onChange={(e) => setCustomer({ email: e.target.value })}
                  className="input-field text-sm py-2"
                />
                <input
                  type="tel"
                  placeholder="Telefone / WhatsApp"
                  value={customer.phone}
                  onChange={(e) => setCustomer({ phone: e.target.value })}
                  className="input-field text-sm py-2"
                />

                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm text-gray-600">
                    {PAYMENT_LABELS[payment]}
                  </span>
                  <span className="text-xl font-black text-brand-500">
                    {formatBRL(subtotal)}
                  </span>
                </div>

                <button
                  disabled={saving}
                  onClick={async () => {
                    if (!customer.name.trim()) {
                      alert("Por favor, informe seu nome para fechar o pedido.");
                      return;
                    }
                    setSaving(true);
                    try {
                      const itemsPayload = items.map((item) => {
                        const product = allProducts.find((p) => p.id === item.productId);
                        const calc = product
                          ? calcProduct(product, globalSettings, overrides[item.productId], categoryOverrides[product.category])
                          : { totalCost: 0, priceCard: 0 };
                        return {
                          productId: item.productId,
                          name: item.name,
                          size: item.size,
                          quantity: item.quantity,
                          unitCost: calc.totalCost,
                          unitPrice: getUnitPrice(item.productId),
                        };
                      });
                      await fetch("/api/orders", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          cartId,
                          customer,
                          items: itemsPayload,
                          paymentMethod: payment,
                          installments: payment === "credito_parcelado" ? selectedInstallments : 1,
                          totalPrice: subtotal,
                        }),
                      });
                    } catch {
                      // Falha silenciosa — não bloquear o checkout do cliente
                    } finally {
                      setSaving(false);
                    }
                    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                    clearCart();
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1fb855] disabled:opacity-60 text-white font-bold py-3 rounded-lg transition-colors text-base"
                >
                  {saving ? (
                    <span className="text-sm">Registrando pedido...</span>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      Enviar Pedido via WhatsApp
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowCheckout(false)}
                  className="w-full text-xs text-gray-400 hover:text-gray-600 py-1"
                >
                  Voltar
                </button>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
