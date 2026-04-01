"use client";

import { useState, useEffect, useCallback } from "react";
import { useCatalog } from "@/context/CatalogContext";
import { formatBRL } from "@/lib/pricing";

type OrderStatus = "pending" | "completed" | "cancelled";

interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  size: string;
  unit_price: number;
  unit_cost: number;
}

interface Order {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  payment_method: string;
  installments: number;
  total_price: number;
  status: OrderStatus;
  created_at: string;
  total_items: number;
  items: OrderItem[];
}

interface Summary {
  total_orders: number;
  completed: number;
  pending: number;
  cancelled: number;
  revenue_completed: number;
  revenue_total: number;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Aguardando",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  credito_vista: "Cartão à vista",
  credito_parcelado: "Parcelado",
  debito: "Débito",
};

export function SalesTab() {
  const { apiSecret } = useCatalog();
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/orders?${params}`, {
        headers: { Authorization: `Bearer ${apiSecret}` },
      });
      if (!res.ok) throw new Error("Falha ao carregar pedidos");
      const data = await res.json();
      setOrders(data.orders || []);
      setSummary(data.summary || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiSecret, days, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    setUpdating(orderId);
    try {
      await fetch(`/api/orders?id=${orderId}&status=${status}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${apiSecret}` },
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
      if (summary) {
        setSummary(null); // força reload do summary na próxima busca
      }
    } catch {
      alert("Erro ao atualizar status");
    } finally {
      setUpdating(null);
    }
  };

  const profitOf = (order: Order) =>
    order.items.reduce(
      (sum, i) => sum + (i.unit_price - i.unit_cost) * i.quantity,
      0
    );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-brand-400 to-brand-500 text-white rounded-xl p-4 col-span-2">
            <p className="text-xs opacity-70 uppercase tracking-wider mb-1">Receita confirmada (últimos {days}d)</p>
            <p className="text-3xl font-black">{formatBRL(Number(summary.revenue_completed))}</p>
            <p className="text-xs opacity-70 mt-1">
              Total enviado: {formatBRL(Number(summary.revenue_total))}
            </p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-yellow-600">{summary.pending}</p>
            <p className="text-xs text-yellow-500 mt-0.5">Aguardando</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-emerald-600">{summary.completed}</p>
            <p className="text-xs text-emerald-500 mt-0.5">Concluídos</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={60}>Últimos 60 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
        >
          <option value="">Todos</option>
          <option value="pending">Aguardando</option>
          <option value="completed">Concluídos</option>
          <option value="cancelled">Cancelados</option>
        </select>
        <button
          onClick={load}
          className="ml-auto text-xs text-brand-500 hover:text-brand-600 font-semibold px-2 py-1.5 border border-brand-200 rounded-lg"
        >
          Atualizar
        </button>
      </div>

      {/* Content */}
      {loading && (
        <div className="text-center py-10 text-gray-400 text-sm">Carregando pedidos...</div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-xl p-4">{error}</div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="font-semibold text-sm">Nenhum pedido encontrado</p>
          <p className="text-xs mt-1">Os pedidos aparecerão aqui quando clientes enviarem pelo WhatsApp.</p>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="space-y-2">
          {orders.map((order) => {
            const isExpanded = expanded === order.id;
            const profit = profitOf(order);
            return (
              <div
                key={order.id}
                className="border border-gray-100 rounded-xl overflow-hidden bg-white"
              >
                {/* Order header */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : order.id)}
                  className="w-full text-left p-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-gray-500">{order.id}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <p className="font-semibold text-sm text-gray-800 mt-0.5 truncate">
                      {order.customer_name || "Cliente não informado"}
                    </p>
                    {order.customer_phone && (
                      <p className="text-xs text-gray-400">{order.customer_phone}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-brand-500 text-sm">{formatBRL(order.total_price)}</p>
                    <p className="text-[10px] text-gray-400">
                      {PAYMENT_LABELS[order.payment_method] || order.payment_method}
                      {order.payment_method === "credito_parcelado" && order.installments > 1
                        ? ` ${order.installments}x`
                        : ""}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(order.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                </button>

                {/* Expanded items */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-3 bg-gray-50">
                    {/* Items list */}
                    <div className="space-y-1">
                      {order.items.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Detalhes dos itens não disponíveis</p>
                      ) : (
                        order.items.map((item) => (
                          <div key={item.id} className="flex justify-between text-xs text-gray-600">
                            <span className="truncate flex-1">
                              {item.product_name || `Produto #${item.product_id}`}
                              {item.size ? ` · ${item.size}` : ""}
                              {" "}× {item.quantity}
                            </span>
                            <span className="font-semibold ml-2 flex-shrink-0">
                              {formatBRL(item.unit_price * item.quantity)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Profit line */}
                    {profit > 0 && (
                      <div className="flex justify-between text-xs pt-1 border-t border-gray-200">
                        <span className="text-gray-500">Lucro estimado</span>
                        <span className="font-bold text-emerald-600">{formatBRL(profit)}</span>
                      </div>
                    )}

                    {/* WhatsApp contact */}
                    {order.customer_phone && (
                      <a
                        href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-[#25D366] font-semibold hover:underline"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        Contatar {order.customer_name || "cliente"}
                      </a>
                    )}

                    {/* Status actions */}
                    {order.status !== "completed" && order.status !== "cancelled" && (
                      <div className="flex gap-2 pt-1">
                        <button
                          disabled={updating === order.id}
                          onClick={() => updateStatus(order.id, "completed")}
                          className="flex-1 text-xs font-semibold py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                        >
                          ✓ Marcar como concluído
                        </button>
                        <button
                          disabled={updating === order.id}
                          onClick={() => updateStatus(order.id, "cancelled")}
                          className="text-xs font-semibold py-2 px-3 bg-white hover:bg-red-50 disabled:opacity-50 text-red-500 border border-red-200 rounded-lg transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}

                    {order.status === "completed" && (
                      <button
                        disabled={updating === order.id}
                        onClick={() => updateStatus(order.id, "pending")}
                        className="w-full text-xs font-semibold py-2 bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-500 border border-gray-200 rounded-lg transition-colors"
                      >
                        Reverter para aguardando
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
