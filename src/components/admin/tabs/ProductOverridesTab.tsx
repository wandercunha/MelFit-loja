"use client";

import { useState, useMemo, useRef } from "react";
import { useCatalog } from "@/context/CatalogContext";
import { PRODUCTS } from "@/data/products";
import { Product } from "@/lib/types";
import { calcProduct, formatBRL, buildAtacadoUrl, buildVarejoUrl } from "@/lib/pricing";
import { ProductFormModal } from "@/components/admin/ProductFormModal";

// Abre produto no catalogo em nova aba (mesma origem)
function goToProduct(name: string) {
  const url = new URL(window.location.origin);
  url.searchParams.set("q", name);
  window.open(url.toString(), "_blank");
}
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/types";
import { useCatalogData } from "@/context/CatalogDataContext";
function toSlug(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+c\/\s*/g, "-c-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}


// ── Custom dialog ─────────────────────────────────────────────────────────────
type DialogConfig = {
  title: string;
  description: string;
  detail?: string;
  confirmLabel: string;
  confirmStyle: "emerald" | "red";
  onConfirm: () => void;
};

function ConfirmDialog({ config, onCancel }: { config: DialogConfig; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            config.confirmStyle === "red" ? "bg-red-50" : "bg-emerald-50"
          }`}>
            {config.confirmStyle === "red" ? (
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">{config.title}</h3>
            <p className="text-xs text-gray-500 mt-1">{config.description}</p>
            {config.detail && (
              <p className="text-[11px] font-mono text-gray-400 mt-1.5 bg-gray-50 px-2 py-1 rounded">{config.detail}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 text-sm font-semibold py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => { config.onConfirm(); onCancel(); }}
            className={`flex-1 text-sm font-semibold py-2 rounded-xl text-white transition-colors ${
              config.confirmStyle === "red"
                ? "bg-red-500 hover:bg-red-600"
                : "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type SortField = "name" | "cost" | "margin" | "shipping" | "varejo" | "card" | "pix" | "profit" | "promo" | "stock";

function SortHeader({
  field, sortField, sortDir, toggle, children, align = "right", className = "",
}: {
  field: SortField;
  sortField: SortField;
  sortDir: "asc" | "desc";
  toggle: (f: SortField) => void;
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const active = sortField === field;
  const alignClass = align === "left" ? "text-left" : align === "center" ? "text-center" : "text-right";
  const flexJustify = align === "left" ? "justify-start" : align === "center" ? "justify-center" : "justify-end";
  return (
    <th className={`${alignClass} px-3 py-1.5 ${className}`}>
      <button
        onClick={() => toggle(field)}
        className={`inline-flex items-center gap-0.5 cursor-pointer hover:text-gray-600 select-none ${flexJustify} ${active ? "text-brand-400 font-bold" : ""}`}
      >
        {children}
        {active && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

export function ProductOverridesTab() {
  const {
    globalSettings, overrides, setOverride, removeOverride,
    categoryOverrides, setCategoryOverride, removeCategoryOverride,
    productVisibility, setProductVisibility, isProductVisible,
    refreshFromDb,
    apiSecret,
  } = useCatalog();
  const { atacadoProducts, atacadoByName, varejoPrecos, allProducts, addCustomProduct, updateCustomProduct, removeCustomProduct, updateVarejoPrice } = useCatalogData();

  // Helper para buscar estoque do atacado
  const getStock = (product: { name: string; slug?: string }): { stock: Record<string, number>; totalStock: number; pieces?: any[] } | null => {
    const slug = product.slug || toSlug(product.name);
    const d = atacadoProducts[slug] as any;
    if (!d) {
      const byName = Object.values(atacadoProducts).find((x: any) => x.name === product.name) as any;
      if (!byName) return null;
      return { stock: byName.stock, totalStock: byName.totalStock, pieces: byName.pieces };
    }
    return { stock: d.stock, totalStock: d.totalStock, pieces: d.pieces };
  };

  // Helper para preço do atacado
  const getAtacadoPrice = (product: { name: string; slug?: string }): number => {
    const slug = product.slug || toSlug(product.name);
    const d = (atacadoProducts[slug] || atacadoByName[product.name]) as any;
    return d?.price || 0;
  };

  const [refreshing, setRefreshing] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingCustomProduct, setEditingCustomProduct] = useState<Product | null>(null);

  // IDs dos produtos estáticos (products.ts) — customizados têm isCustom ou ID não presente aqui
  const staticIds = useMemo(() => new Set(PRODUCTS.map((p) => p.id)), []);
  const isCustomProduct = (id: number) => !staticIds.has(id);

  const handleSaveProduct = async (product: Product) => {
    if (editingCustomProduct) {
      await updateCustomProduct(product);
    } else {
      await addCustomProduct(product);
    }
    setShowProductForm(false);
    setEditingCustomProduct(null);
  };

  const handleDeleteProduct = async (id: number) => {
    if (confirm("Remover este produto do catalogo?")) {
      await removeCustomProduct(id);
    }
  };

  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<"margin" | "shipping" | "promo">("margin");
  const [editMargin, setEditMargin] = useState(0);
  const [editShipping, setEditShipping] = useState(0);
  const [editFakeDiscount, setEditFakeDiscount] = useState(0);
  const [showOnlyOverrides, setShowOnlyOverrides] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  // Sort state — default alfabético por nome
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir(field === "name" ? "asc" : "desc"); }
  };

  // Category edit state
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingCatField, setEditingCatField] = useState<"margin" | "shipping">("margin");
  const [editCatMargin, setEditCatMargin] = useState(0);
  const [editCatShipping, setEditCatShipping] = useState(0);

  // Image zoom state — simple fullscreen overlay
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Tooltip state
  const [tooltipId, setTooltipId] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTooltip = (id: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setTooltipId(id);
  };
  const hideTooltip = () => {
    hideTimer.current = setTimeout(() => setTooltipId(null), 200);
  };

  // Scrape preço individual do varejo
  const [scrapingPrice, setScrapingPrice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const handleScrapePrice = async (productName: string, slug?: string) => {
    setScrapingPrice(productName);
    try {
      const session = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("melfit_session") || "{}") : {};
      const res = await fetch("/api/scrape-price", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.apiSecret}` },
        body: JSON.stringify({ productName, slug: slug || toSlug(productName) }),
      });
      const data = await res.json();
      if (data.success && data.price > 0) {
        updateVarejoPrice(productName, data.price);
        const via = data.method?.startsWith("busca") ? ` (via ${data.method})` : "";
        showToast(`${productName}: ${formatBRL(data.price)}${via}`, "success");
      } else {
        showToast(data.error || "Preco nao encontrado no varejo", "error");
      }
    } catch {
      showToast("Erro ao buscar preco", "error");
    }
    setScrapingPrice(null);
  };

  // Dialog state
  const [dialog, setDialog] = useState<DialogConfig | null>(null);

  const [showDisabled, setShowDisabled] = useState(false);

  const products = useMemo(() => {
    let list = [...allProducts];
    if (showDisabled) {
      // Mostra apenas os desativados
      list = list.filter((p) => !isProductVisible(p.id, p.soldOut));
    } else {
      // Mostra apenas os ativos
      list = list.filter((p) => isProductVisible(p.id, p.soldOut));
    }
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      );
    }
    if (showOnlyOverrides) list = list.filter((p) => overrides[p.id]);
    return list;
  }, [allProducts, filter, showOnlyOverrides, overrides, showDisabled, productVisibility]);

  // Group by category + ordenação configurável
  const groupedProducts = useMemo(() => {
    const groups: Record<string, typeof products> = {};
    for (const p of products) {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }

    const dir = sortDir === "asc" ? 1 : -1;
    const sortKey = (p: Product): number | string => {
      const ov = overrides[p.id];
      const catOv = categoryOverrides[p.category];
      const calc = calcProduct(p, globalSettings, ov, catOv);
      switch (sortField) {
        case "name": return p.name.toLowerCase();
        case "cost": return p.cost;
        case "margin": return calc.appliedMargin;
        case "shipping": return calc.shipping;
        case "varejo": return varejoPrecos[p.name] || 0;
        case "card": return calc.priceInstallment;
        case "pix": return calc.pricePix;
        case "profit": return calc.netProfit;
        case "promo": return ov?.fakeDiscount || 0;
        case "stock": {
          const s = atacadoProducts[p.slug || toSlug(p.name)] as any;
          return s?.totalStock ?? -1;
        }
        default: return p.name.toLowerCase();
      }
    };

    return CATEGORY_ORDER
      .filter((cat) => groups[cat] && groups[cat].length > 0)
      .map((cat) => {
        const sorted = [...groups[cat]].sort((a, b) => {
          const ka = sortKey(a); const kb = sortKey(b);
          if (typeof ka === "string" && typeof kb === "string") return ka.localeCompare(kb) * dir;
          return ((ka as number) - (kb as number)) * dir;
        });
        return { category: cat, products: sorted };
      });
  }, [products, sortField, sortDir, overrides, categoryOverrides, globalSettings, varejoPrecos, atacadoProducts]);

  const overrideCount = Object.keys(overrides).length;
  const catOverrideCount = Object.keys(categoryOverrides).length;
  const disabledCount = allProducts.filter((p) => !isProductVisible(p.id, p.soldOut)).length;

  const toggleCat = (cat: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // ── Product edit ──
  const startEdit = (productId: number, field: "margin" | "shipping") => {
    const ov = overrides[productId];
    const p = allProducts.find((x) => x.id === productId);
    const catOv = p ? categoryOverrides[p.category] : undefined;
    setEditMargin(ov?.margin ?? catOv?.margin ?? globalSettings.margin);
    setEditShipping(ov?.shipping ?? catOv?.shipping ?? globalSettings.shipping);
    setEditFakeDiscount(ov?.fakeDiscount ?? 0);
    setEditingId(productId);
    setEditingField(field);
    setEditingCat(null);
  };

  const saveMargin = (productId: number) => {
    const ov = overrides[productId];
    setOverride(productId, { margin: editMargin, shipping: ov?.shipping, fakeDiscount: ov?.fakeDiscount });
    setEditingId(null);
  };

  const saveShipping = (productId: number) => {
    const ov = overrides[productId];
    setOverride(productId, { margin: ov?.margin, shipping: editShipping, fakeDiscount: ov?.fakeDiscount });
    setEditingId(null);
  };

  // ── Category edit ──
  const startCatEdit = (cat: string, field: "margin" | "shipping") => {
    const ov = categoryOverrides[cat];
    setEditCatMargin(ov?.margin ?? globalSettings.margin);
    setEditCatShipping(ov?.shipping ?? globalSettings.shipping);
    setEditingCat(cat);
    setEditingCatField(field);
    setEditingId(null);
  };

  const saveCatMargin = (cat: string) => {
    const ov = categoryOverrides[cat];
    setCategoryOverride(cat, { margin: editCatMargin, shipping: ov?.shipping });
    setEditingCat(null);
  };

  const saveCatShipping = (cat: string) => {
    const ov = categoryOverrides[cat];
    setCategoryOverride(cat, { margin: ov?.margin, shipping: editCatShipping });
    setEditingCat(null);
  };

  // ── Resets ──
  const requestResetField = (productId: number, productName: string, field: "margin" | "shipping") => {
    const ov = overrides[productId];
    if (!ov) return;
    const isMargin = field === "margin";
    const hasOtherOverride = isMargin ? ov.shipping !== undefined : ov.margin !== undefined;

    setDialog({
      title: isMargin ? "Redefinir margem?" : "Redefinir frete?",
      description: isMargin
        ? `Voltar a margem de "${productName}" para o valor da categoria/global.`
        : `Voltar o frete de "${productName}" para o valor da categoria/global.`,
      confirmLabel: "Redefinir",
      confirmStyle: "red",
      onConfirm: () => {
        if (hasOtherOverride) {
          setOverride(productId, isMargin ? { shipping: ov.shipping! } : { margin: ov.margin! });
        } else {
          removeOverride(productId);
        }
        setEditingId(null);
      },
    });
  };

  const requestResetCatField = (cat: string, field: "margin" | "shipping") => {
    const ov = categoryOverrides[cat];
    if (!ov) return;
    const isMargin = field === "margin";
    const hasOther = isMargin ? ov.shipping !== undefined : ov.margin !== undefined;

    setDialog({
      title: isMargin ? "Redefinir margem da categoria?" : "Redefinir frete da categoria?",
      description: `Voltar ${isMargin ? "a margem" : "o frete"} de "${CATEGORY_LABELS[cat]}" para o valor global.`,
      confirmLabel: "Redefinir",
      confirmStyle: "red",
      onConfirm: () => {
        if (hasOther) {
          setCategoryOverride(cat, isMargin ? { shipping: ov.shipping! } : { margin: ov.margin! });
        } else {
          removeCategoryOverride(cat);
        }
        setEditingCat(null);
      },
    });
  };

  const requestResetAll = () => {
    setDialog({
      title: "Resetar todos?",
      description: `Remover todos os ${overrideCount} overrides individuais e ${catOverrideCount} de categoria.`,
      confirmLabel: "Resetar tudo",
      confirmStyle: "red",
      onConfirm: () => {
        Object.keys(overrides).forEach((id) => removeOverride(Number(id)));
        Object.keys(categoryOverrides).forEach((cat) => removeCategoryOverride(cat));
      },
    });
  };

  const runSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/scrape", {
        headers: { Authorization: `Bearer ${apiSecret}` },
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setSyncResult({ ok: true, msg: `${data.count} produtos | ${data.changesDetected} alteracoes` });
      } else {
        setSyncResult({ ok: false, msg: data.error || "Varejo bloqueou acesso. Rode npm run scrape localmente." });
      }
    } catch (err: any) {
      setSyncResult({ ok: false, msg: err.message || "Falha na conexao" });
    } finally {
      setSyncing(false);
    }
  };

  // ── Render helpers ──
  const renderThumb = (img: string | undefined, size = "w-9 h-9") => {
    if (!img) return <div className={`${size} rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-[10px] flex-shrink-0`}>?</div>;
    return (
      <img
        src={img}
        alt=""
        className={`${size} rounded-lg object-cover flex-shrink-0 cursor-zoom-in`}
        loading="lazy"
        onClick={(e) => { e.stopPropagation(); setZoomImg(zoomImg === img ? null : img); }}
      />
    );
  };

  const closePopover = () => { setEditingId(null); setEditingCat(null); };

  const popoverKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      closePopover();
    }
  };

  const renderPopover = (
    value: number,
    label: string,
    onChange: (v: number) => void,
    onSave: () => void,
    onReset: (() => void) | null,
    hasOverride: boolean,
  ) => {
    const content = (
      <div className="space-y-2.5" onKeyDown={popoverKeyDown}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700">{label}</span>
          <button onClick={closePopover} className="text-gray-400 hover:text-gray-600">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <input
          type="text"
          inputMode="decimal"
          value={value || ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "" || raw === "-") { onChange(0); return; }
            const num = parseFloat(raw);
            if (!isNaN(num)) onChange(num);
          }}
          className="w-full px-2 py-1.5 text-base border rounded-lg text-right"
          autoFocus
          onFocus={(e) => e.target.select()}
        />
        <div className="flex gap-1.5">
          <button onClick={onSave} className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors">
            Salvar
          </button>
          {hasOverride && onReset && (
            <button onClick={onReset} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
              Redefinir
            </button>
          )}
        </div>
      </div>
    );

    return (
      <>
        {/* Mobile: centered overlay */}
        <div className="lg:hidden fixed inset-0 z-[90] bg-black/20 flex items-center justify-center" onClick={closePopover}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-56" onClick={(e) => e.stopPropagation()}>
            {content}
          </div>
        </div>
        {/* Desktop: dropdown */}
        <div className="hidden lg:block absolute top-full right-0 mt-1.5 z-[95] bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-48" onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
      </>
    );
  };

  return (
    <>
      {dialog && <ConfirmDialog config={dialog} onCancel={() => setDialog(null)} />}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-[300] px-4 py-2.5 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2 animate-fade-in-up ${
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.type === "success" ? (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          )}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100">&times;</button>
        </div>
      )}

      {/* Image zoom overlay */}
      {zoomImg && (
        <div className="fixed inset-0 z-[150] bg-black/50 flex items-center justify-center p-8" onClick={() => setZoomImg(null)}>
          <img src={zoomImg} alt="" className="max-w-[280px] max-h-[280px] rounded-2xl object-cover shadow-2xl border-2 border-white" />
        </div>
      )}

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
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setEditingCustomProduct(null); setShowProductForm(true); }}
              className="text-xs font-semibold px-3 py-2 rounded-lg bg-brand-400 text-white hover:bg-brand-500 whitespace-nowrap flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Novo Produto
            </button>
            <button
              onClick={async () => { setRefreshing(true); await refreshFromDb(); setRefreshing(false); }}
              disabled={refreshing}
              className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                refreshing ? "bg-gray-200 text-gray-400 cursor-wait" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              title="Recarregar valores do banco"
            >
              <svg className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? "..." : "Refresh"}
            </button>
            <button
              onClick={runSync}
              disabled={syncing}
              className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                syncing ? "bg-blue-100 text-blue-400 cursor-wait" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
              }`}
            >
              <svg className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? "Atualizando..." : "Atualizar Precos"}
            </button>
            <button
              onClick={() => setShowOnlyOverrides(!showOnlyOverrides)}
              className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                showOnlyOverrides ? "bg-brand-400 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              Personalizados ({overrideCount})
            </button>
            <button
              onClick={() => setShowDisabled(!showDisabled)}
              className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                showDisabled ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              Desativados ({disabledCount})
            </button>
            {(overrideCount > 0 || catOverrideCount > 0) && (
              <button
                onClick={requestResetAll}
                className="text-xs font-semibold px-3 py-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors whitespace-nowrap"
              >
                Resetar Todos
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs text-gray-400">
            Global: margem {globalSettings.margin}% | frete {formatBRL(globalSettings.shipping)} | {products.length} produtos
          </p>
          {syncResult && (
            <p className={`text-xs font-semibold flex items-center gap-1 ${syncResult.ok ? "text-emerald-600" : "text-red-500"}`}>
              {syncResult.ok ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              )}
              {syncResult.msg}
            </p>
          )}
        </div>

        {/* Desktop table — grouped by category */}
        <div className="hidden lg:block space-y-3">
          {groupedProducts.map(({ category, products: catProducts }) => {
            const isCollapsed = collapsedCats.has(category);
            const catOv = categoryOverrides[category];
            const hasCatOverride = !!catOv;
            const catMargin = catOv?.margin ?? globalSettings.margin;
            const catShipping = catOv?.shipping ?? globalSettings.shipping;

            return (
              <div key={category} className="rounded-xl border border-gray-200">
                {/* Category header */}
                <div
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none ${
                    hasCatOverride ? "bg-brand-400/10" : "bg-gray-50"
                  }`}
                  onClick={() => toggleCat(category)}
                >
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? "" : "rotate-90"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-bold text-gray-700 flex-1">
                    {CATEGORY_LABELS[category]}
                    <span className="ml-2 text-xs font-normal text-gray-400">({catProducts.length})</span>
                  </span>

                  {/* Category margin */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => (editingCat === category && editingCatField === "margin") ? setEditingCat(null) : startCatEdit(category, "margin")}
                      className={`text-xs px-2 py-1 rounded-lg hover:underline decoration-dotted ${hasCatOverride && catOv?.margin !== undefined ? "text-brand-500 font-bold" : "text-gray-500"}`}
                    >
                      Margem: {catMargin}%
                    </button>
                    {editingCat === category && editingCatField === "margin" &&
                      renderPopover(
                        editCatMargin, "Margem da Categoria %",
                        setEditCatMargin,
                        () => saveCatMargin(category),
                        hasCatOverride && catOv?.margin !== undefined ? () => requestResetCatField(category, "margin") : null,
                        hasCatOverride && catOv?.margin !== undefined,
                      )
                    }
                  </div>

                  {/* Category shipping */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => (editingCat === category && editingCatField === "shipping") ? setEditingCat(null) : startCatEdit(category, "shipping")}
                      className={`text-xs px-2 py-1 rounded-lg hover:underline decoration-dotted ${hasCatOverride && catOv?.shipping !== undefined ? "text-brand-500 font-bold" : "text-gray-500"}`}
                    >
                      Frete: {formatBRL(catShipping)}
                    </button>
                    {editingCat === category && editingCatField === "shipping" &&
                      renderPopover(
                        editCatShipping, "Frete da Categoria R$",
                        setEditCatShipping,
                        () => saveCatShipping(category),
                        hasCatOverride && catOv?.shipping !== undefined ? () => requestResetCatField(category, "shipping") : null,
                        hasCatOverride && catOv?.shipping !== undefined,
                      )
                    }
                  </div>
                </div>

                {/* Products table */}
                {!isCollapsed && (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/50 text-[10px] text-gray-400 uppercase">
                      <tr>
                        <th className="w-10 px-2 py-1.5"></th>
                        <SortHeader field="name" align="left" sortField={sortField} sortDir={sortDir} toggle={toggleSort}>Produto</SortHeader>
                        <SortHeader field="cost" sortField={sortField} sortDir={sortDir} toggle={toggleSort}>Custo</SortHeader>
                        <SortHeader field="margin" sortField={sortField} sortDir={sortDir} toggle={toggleSort}>Margem</SortHeader>
                        <SortHeader field="shipping" sortField={sortField} sortDir={sortDir} toggle={toggleSort}>Frete</SortHeader>
                        <th className="text-right px-3 py-1.5">
                          <span onClick={() => toggleSort("varejo")} className="cursor-pointer hover:text-gray-600 select-none inline-flex items-center gap-0.5">
                            Varejo
                            {sortField === "varejo" && <span className="text-brand-400">{sortDir === "asc" ? "▲" : "▼"}</span>}
                            <span className="group/varejo relative">
                              <span className="inline-flex items-center justify-center w-3 h-3 ml-0.5 rounded-full bg-gray-200 text-gray-400 text-[8px] font-bold align-middle">?</span>
                              <span className="absolute top-full right-0 mt-1 hidden group-hover/varejo:block z-50 w-52 bg-gray-900 text-white text-[11px] font-normal normal-case tracking-normal rounded-lg px-3 py-2 shadow-xl leading-relaxed">
                                Preco no site de varejo (floraamar.com.br).
                                <span className="block mt-1 text-emerald-400">-X% = seu preco esta abaixo</span>
                                <span className="block text-red-400">+X% = seu preco esta acima</span>
                              </span>
                            </span>
                          </span>
                        </th>
                        <SortHeader field="card" sortField={sortField} sortDir={sortDir} toggle={toggleSort}>Cartao</SortHeader>
                        <SortHeader field="pix" sortField={sortField} sortDir={sortDir} toggle={toggleSort}>PIX</SortHeader>
                        <SortHeader field="profit" sortField={sortField} sortDir={sortDir} toggle={toggleSort}>Lucro</SortHeader>
                        <SortHeader field="promo" align="center" sortField={sortField} sortDir={sortDir} toggle={toggleSort} className="text-red-400">Promo</SortHeader>
                        <SortHeader field="stock" align="center" sortField={sortField} sortDir={sortDir} toggle={toggleSort}>Estoque</SortHeader>
                        <th className="text-center px-2 py-1.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {catProducts.map((p) => {
                        const ov = overrides[p.id];
                        const calc = calcProduct(p, globalSettings, ov, catOv);
                        const isEditing = editingId === p.id;
                        const hasOverride = !!ov;
                        const visible = isProductVisible(p.id, p.soldOut);
                        const stockInfo = getStock(p);

                        return (
                          <tr
                            key={p.id}
                            className={`group/row hover:bg-gray-50 transition-colors ${!visible ? "opacity-40" : ""} ${hasOverride ? "bg-brand-400/5" : ""}`}
                          >
                            {/* Thumb */}
                            <td className="px-2 py-1.5 w-10">
                              {renderThumb(p.img)}
                            </td>
                            {/* Nome — max 2 linhas */}
                            <td className="px-3 py-2 font-semibold text-gray-800 max-w-[250px]">
                              <div className="relative inline-flex items-start gap-1">
                                {hasOverride && <span className="flex-shrink-0 inline-block w-1.5 h-1.5 rounded-full bg-brand-400 mt-1.5" />}
                                <span
                                  className="cursor-default underline decoration-dotted decoration-gray-300 leading-snug line-clamp-2"
                                  onMouseEnter={() => showTooltip(p.id)}
                                  onMouseLeave={hideTooltip}
                                >
                                  {p.name}
                                </span>
                                {tooltipId === p.id && (
                                  <div
                                    className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 flex flex-col gap-1 bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2.5 shadow-xl whitespace-nowrap min-w-[220px]"
                                    onMouseEnter={() => showTooltip(p.id)}
                                    onMouseLeave={hideTooltip}
                                  >
                                    <button onClick={() => goToProduct(p.name)} className="flex items-center gap-1.5 hover:text-brand-300">
                                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                      Ver no catalogo
                                    </button>
                                    {(() => {
                                      const atPrice = getAtacadoPrice(p);
                                      const stockData = getStock(p);
                                      const pcs = stockData?.pieces || [];
                                      const isConj = pcs.length > 0;
                                      return (
                                        <>
                                          <a href={buildAtacadoUrl(p, atacadoByName)} className="flex items-center gap-1.5 hover:text-brand-300" target="_blank" rel="noopener noreferrer">
                                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                            Atacado{atPrice ? ` — ${formatBRL(atPrice)}` : ""}
                                          </a>
                                          {isConj ? (
                                            <>
                                              {varejoPrecos[p.name] != null && (
                                                <a href={buildVarejoUrl(p)} className="flex items-center gap-1.5 hover:text-blue-300 text-blue-400" target="_blank" rel="noopener noreferrer">
                                                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                  Varejo (conj.) — {formatBRL(varejoPrecos[p.name])}
                                                </a>
                                              )}
                                              {pcs.map((piece: any) => {
                                                const vPrice = varejoPrecos[piece.name];
                                                return vPrice != null ? (
                                                  <a key={piece.name} href={buildVarejoUrl({ name: piece.name })} className="flex items-center gap-1.5 hover:text-blue-300 text-blue-300/70 pl-3" target="_blank" rel="noopener noreferrer">
                                                    {piece.name.split(" ").slice(0, 2).join(" ")} — {formatBRL(vPrice)}
                                                  </a>
                                                ) : null;
                                              })}
                                              {varejoPrecos[p.name] == null && !pcs.some((pc: any) => varejoPrecos[pc.name] != null) && (
                                                <span className="text-gray-500 text-[11px]">Varejo: sem preco</span>
                                              )}
                                            </>
                                          ) : (
                                            <a href={buildVarejoUrl(p)} className="flex items-center gap-1.5 hover:text-blue-300 text-blue-400" target="_blank" rel="noopener noreferrer">
                                              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                              Varejo{varejoPrecos[p.name] ? ` — ${formatBRL(varejoPrecos[p.name])}` : ""}
                                            </a>
                                          )}
                                          <button
                                            onClick={() => handleScrapePrice(p.name, p.slug)}
                                            disabled={scrapingPrice === p.name}
                                            className="flex items-center gap-1.5 hover:text-emerald-300 text-emerald-400 mt-1 pt-1 border-t border-white/10"
                                          >
                                            <svg className={`w-3 h-3 flex-shrink-0 ${scrapingPrice === p.name ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            {scrapingPrice === p.name ? "Buscando..." : "Atualizar preco"}
                                          </button>
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="px-3 py-2 text-right text-gray-600">{formatBRL(p.cost)}</td>

                            {/* Margem */}
                            <td className="px-3 py-2 text-right">
                              <div className="relative inline-block">
                                <button
                                  onClick={() => (isEditing && editingField === "margin") ? setEditingId(null) : startEdit(p.id, "margin")}
                                  className={`cursor-pointer hover:underline decoration-dotted ${hasOverride && ov?.margin !== undefined ? "text-brand-500 font-bold" : "text-gray-600"}`}
                                >
                                  {calc.appliedMargin}%
                                </button>
                                {isEditing && editingField === "margin" &&
                                  renderPopover(
                                    editMargin, "Margem %",
                                    setEditMargin,
                                    () => saveMargin(p.id),
                                    hasOverride && ov?.margin !== undefined ? () => requestResetField(p.id, p.name, "margin") : null,
                                    hasOverride && ov?.margin !== undefined,
                                  )
                                }
                              </div>
                            </td>

                            {/* Frete */}
                            <td className="px-3 py-2 text-right">
                              <div className="relative inline-block">
                                <button
                                  onClick={() => (isEditing && editingField === "shipping") ? setEditingId(null) : startEdit(p.id, "shipping")}
                                  className={`cursor-pointer hover:underline decoration-dotted ${hasOverride && ov?.shipping !== undefined ? "text-brand-500 font-bold" : "text-gray-600"}`}
                                >
                                  {formatBRL(calc.shipping)}
                                </button>
                                {isEditing && editingField === "shipping" &&
                                  renderPopover(
                                    editShipping, "Frete R$",
                                    setEditShipping,
                                    () => saveShipping(p.id),
                                    hasOverride && ov?.shipping !== undefined ? () => requestResetField(p.id, p.name, "shipping") : null,
                                    hasOverride && ov?.shipping !== undefined,
                                  )
                                }
                              </div>
                            </td>

                            {/* Varejo */}
                            <td className="px-3 py-2 text-right">
                              {(() => {
                                // Coluna varejo: só preço direto do produto (nome exato)
                                // Para conjuntos: só mostra se o conjunto inteiro existe no varejo
                                const retail = varejoPrecos[p.name];
                                if (!retail) return <span className="text-gray-300">—</span>;
                                const myPrice = Math.round(calc.priceInstallment);
                                const diff = myPrice - retail;
                                const pct = ((diff / retail) * 100).toFixed(0);
                                return (
                                  <div className="flex flex-col items-end">
                                    <span className="text-gray-600 font-medium">{formatBRL(retail)}</span>
                                    <span className={`text-[10px] font-semibold ${diff < 0 ? "text-emerald-500" : diff === 0 ? "text-gray-400" : "text-red-400"}`}>
                                      {diff < 0 ? `${pct}%` : diff === 0 ? "igual" : `+${pct}%`}
                                    </span>
                                  </div>
                                );
                              })()}
                            </td>

                            <td className="px-3 py-2 text-right font-semibold">{formatBRL(Math.round(calc.priceInstallment))}</td>
                            <td className="px-3 py-2 text-right text-emerald-600 font-semibold">{formatBRL(Math.round(calc.pricePix))}</td>
                            <td className="px-3 py-2 text-right">
                              <span className={calc.netProfit >= 0 ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>
                                {formatBRL(calc.netProfit)}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <div className="relative inline-block">
                                <button
                                  onClick={() => { startEdit(p.id, "margin"); setEditingField("promo" as any); }}
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer ${ov?.fakeDiscount ? "bg-red-100 text-red-600" : "text-gray-300 hover:text-gray-500"}`}
                                >
                                  {ov?.fakeDiscount ? `-${ov.fakeDiscount}%` : "—"}
                                </button>
                                {isEditing && editingField === ("promo" as any) &&
                                  renderPopover(
                                    editFakeDiscount, "Promo %",
                                    setEditFakeDiscount,
                                    () => { setOverride(p.id, { ...ov, fakeDiscount: editFakeDiscount || undefined }); setEditingId(null); },
                                    ov?.fakeDiscount ? () => { setOverride(p.id, { ...ov, fakeDiscount: undefined }); setEditingId(null); } : null,
                                    !!ov?.fakeDiscount,
                                  )
                                }
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {stockInfo ? (
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {stockInfo.pieces && stockInfo.pieces.length > 0 ? (
                                    stockInfo.pieces.map((pc: any) => (
                                      <span key={pc.name} className="text-[10px] font-bold px-1 py-0.5 rounded bg-blue-50 text-blue-600" title={pc.name}>
                                        {Object.keys(pc.sizes).join(",")}
                                      </span>
                                    ))
                                  ) : Object.keys(stockInfo.stock).length > 0 ? (
                                    Object.entries(stockInfo.stock).map(([size, qty]) => (
                                      <span key={size} className={`text-[10px] font-bold px-1 py-0.5 rounded ${qty > 0 ? (qty <= 5 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600") : "bg-red-50 text-red-400 line-through"}`}>
                                        {size}:{qty}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] font-bold text-red-400">Esgotado</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-300 text-[10px]">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <div className="flex items-center gap-1 justify-center">
                                <button
                                  onClick={() => setProductVisibility(p.id, !visible)}
                                  className={`w-9 h-5 rounded-full relative transition-colors inline-flex items-center ${visible ? "bg-emerald-400" : "bg-gray-300"}`}
                                  title={visible ? "Desativar produto" : "Ativar produto"}
                                >
                                  <span className={`inline-block w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${visible ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                                </button>
                                {isCustomProduct(p.id) && (
                                  <button onClick={() => handleDeleteProduct(p.id)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-red-300 hover:text-red-500" title="Excluir produto">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile cards — grouped by category */}
        <div className="lg:hidden space-y-4">
          {groupedProducts.map(({ category, products: catProducts }) => {
            const isCollapsed = collapsedCats.has(category);
            const catOv = categoryOverrides[category];
            const hasCatOverride = !!catOv;
            const catMargin = catOv?.margin ?? globalSettings.margin;
            const catShipping = catOv?.shipping ?? globalSettings.shipping;

            return (
              <div key={category}>
                {/* Category header with margin/shipping controls */}
                <div className={`rounded-lg ${hasCatOverride ? "bg-brand-400/10" : "bg-gray-100"}`}>
                  <button
                    onClick={() => toggleCat(category)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                  >
                    <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isCollapsed ? "" : "rotate-90"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-bold text-gray-700 flex-1">{CATEGORY_LABELS[category]}</span>
                    <span className="text-[10px] text-gray-400">{catProducts.length}</span>
                  </button>
                  {/* Category margin/shipping edit */}
                  <div className="flex gap-2 px-3 pb-2" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                      <button
                        onClick={() => (editingCat === category && editingCatField === "margin") ? setEditingCat(null) : startCatEdit(category, "margin")}
                        className={`text-[11px] px-2 py-0.5 rounded hover:underline decoration-dotted ${hasCatOverride && catOv?.margin !== undefined ? "text-brand-500 font-bold" : "text-gray-500"}`}
                      >
                        Margem: {catMargin}%
                      </button>
                      {editingCat === category && editingCatField === "margin" &&
                        renderPopover(editCatMargin, "Margem da Categoria %", setEditCatMargin, () => saveCatMargin(category), hasCatOverride && catOv?.margin !== undefined ? () => requestResetCatField(category, "margin") : null, hasCatOverride && catOv?.margin !== undefined)
                      }
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => (editingCat === category && editingCatField === "shipping") ? setEditingCat(null) : startCatEdit(category, "shipping")}
                        className={`text-[11px] px-2 py-0.5 rounded hover:underline decoration-dotted ${hasCatOverride && catOv?.shipping !== undefined ? "text-brand-500 font-bold" : "text-gray-500"}`}
                      >
                        Frete: {formatBRL(catShipping)}
                      </button>
                      {editingCat === category && editingCatField === "shipping" &&
                        renderPopover(editCatShipping, "Frete da Categoria R$", setEditCatShipping, () => saveCatShipping(category), hasCatOverride && catOv?.shipping !== undefined ? () => requestResetCatField(category, "shipping") : null, hasCatOverride && catOv?.shipping !== undefined)
                      }
                    </div>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="space-y-2 mt-2">
                    {catProducts.map((p) => {
                      const ov = overrides[p.id];
                      const calc = calcProduct(p, globalSettings, ov, catOv);
                      const hasOverride = !!ov;
                      const isEditing = editingId === p.id;
                      const visible = isProductVisible(p.id, p.soldOut);
                      const retail = varejoPrecos[p.name] || 0;
                      const myPrice = Math.round(calc.priceInstallment);
                      const retailDiff = retail ? ((myPrice - retail) / retail * 100).toFixed(0) : null;
                      const stockData = getStock(p);

                      return (
                        <div
                          key={p.id}
                          className={`rounded-xl p-3 border ${!visible ? "opacity-40" : ""} ${hasOverride ? "border-brand-300 bg-brand-400/5" : "border-gray-200 bg-white"}`}
                        >
                          {/* Linha 1: Toggle + Thumb + Nome + Editar */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setProductVisibility(p.id, !visible)}
                              className={`flex-shrink-0 w-9 h-5 rounded-full relative transition-colors inline-flex items-center ${visible ? "bg-emerald-400" : "bg-gray-300"}`}
                            >
                              <span className={`inline-block w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${visible ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                            </button>
                            {renderThumb(p.img, "w-11 h-11")}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 leading-snug">
                                {hasOverride && <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-400 mr-1 align-middle" />}
                                {p.name}
                              </p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                <button onClick={() => goToProduct(p.name)} className="text-[10px] text-brand-400 font-semibold flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                  Catalogo
                                </button>
                              </div>
                              {(() => {
                                const atPrice = getAtacadoPrice(p);
                                const stockData = getStock(p);
                                const pcs = stockData?.pieces || [];
                                const isConj = pcs.length > 0;
                                return (
                                  <div className="mt-0.5 space-y-0.5">
                                    <a href={buildAtacadoUrl(p, atacadoByName)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-400 font-semibold flex items-center gap-1">
                                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                      Atacado{atPrice ? ` — ${formatBRL(atPrice)}` : ""}
                                    </a>
                                    {isConj ? (
                                      <>
                                        {varejoPrecos[p.name] != null && (
                                          <a href={buildVarejoUrl(p)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 font-semibold flex items-center gap-1">
                                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                            Varejo (conj.) — {formatBRL(varejoPrecos[p.name])}
                                          </a>
                                        )}
                                        {pcs.map((piece: any) => {
                                          const vPrice = varejoPrecos[piece.name];
                                          return vPrice != null ? (
                                            <a key={piece.name} href={buildVarejoUrl({ name: piece.name })} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400/70 font-semibold flex items-center gap-1 pl-4">
                                              {piece.name.split(" ").slice(0, 2).join(" ")} — {formatBRL(vPrice)}
                                            </a>
                                          ) : null;
                                        })}
                                      </>
                                    ) : (
                                      <a href={buildVarejoUrl(p)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 font-semibold flex items-center gap-1">
                                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                        Varejo{varejoPrecos[p.name] ? ` — ${formatBRL(varejoPrecos[p.name])}` : ""}
                                      </a>
                                    )}
                                    <button
                                      onClick={() => handleScrapePrice(p.name, p.slug)}
                                      disabled={scrapingPrice === p.name}
                                      className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1 mt-0.5"
                                    >
                                      <svg className={`w-3 h-3 shrink-0 ${scrapingPrice === p.name ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                      {scrapingPrice === p.name ? "Buscando..." : "Atualizar preco"}
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                            {isEditing ? (
                              <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => { setOverride(p.id, { margin: editMargin, shipping: editShipping, fakeDiscount: editFakeDiscount || undefined }); setEditingId(null); }} className="text-[11px] px-2 py-1 bg-emerald-500 text-white rounded-lg font-semibold">Salvar</button>
                                <button onClick={() => setEditingId(null)} className="text-[11px] px-2 py-1 bg-gray-200 text-gray-600 rounded-lg">X</button>
                              </div>
                            ) : (
                              <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => startEdit(p.id, "margin")} className="text-[11px] px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg font-medium">Margem</button>
                                {isCustomProduct(p.id) && (
                                  <>
                                    <button onClick={() => { setEditingCustomProduct(p); setShowProductForm(true); }} className="text-[11px] px-2 py-1 bg-blue-50 text-blue-500 rounded-lg font-medium">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button onClick={() => handleDeleteProduct(p.id)} className="text-[11px] px-2 py-1 bg-red-50 text-red-400 rounded-lg font-medium">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500">Margem %</label>
                                <input type="text" inputMode="decimal" value={editMargin || ""} onChange={(e) => { const v = parseFloat(e.target.value); setEditMargin(isNaN(v) ? 0 : v); }} onFocus={(e) => e.target.select()} className="w-full px-2 py-1.5 border rounded-lg text-base text-right" />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500">Frete R$</label>
                                <input type="text" inputMode="decimal" value={editShipping || ""} onChange={(e) => { const v = parseFloat(e.target.value); setEditShipping(isNaN(v) ? 0 : v); }} onFocus={(e) => e.target.select()} className="w-full px-2 py-1.5 border rounded-lg text-base text-right" />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-red-400">Promo %</label>
                                <input type="text" inputMode="decimal" value={editFakeDiscount || ""} onChange={(e) => { const v = parseFloat(e.target.value); setEditFakeDiscount(isNaN(v) ? 0 : v); }} onFocus={(e) => e.target.select()} placeholder="0" className="w-full px-2 py-1.5 border border-red-200 rounded-lg text-base text-right" />
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Linha 2: Margem + Custo Atacado + Varejo */}
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                <span className={`font-bold ${hasOverride ? "text-brand-500" : "text-gray-600"}`}>
                                  {calc.appliedMargin}%
                                </span>
                                <span className="text-gray-800 font-semibold">
                                  Custo {formatBRL(p.cost)}
                                </span>
                                {retail ? (
                                  <span className="flex items-center gap-1">
                                    <span className="text-gray-600 font-medium">Varejo {formatBRL(retail)}</span>
                                    <span className={`text-[10px] font-bold ${Number(retailDiff) < 0 ? "text-emerald-500" : Number(retailDiff) === 0 ? "text-gray-400" : "text-red-400"}`}>
                                      {Number(retailDiff) < 0 ? retailDiff : `+${retailDiff}`}%
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-[10px]">Varejo —</span>
                                )}
                              </div>

                              {/* Linha 3: Cartao + PIX + Lucro */}
                              <div className="flex items-center gap-3 mt-1 text-xs">
                                <span className="text-gray-800 font-semibold">Cartao {formatBRL(myPrice)}</span>
                                <span className="text-emerald-600 font-semibold">PIX {formatBRL(Math.round(calc.pricePix))}</span>
                                <span className={`font-bold ${calc.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                  Lucro {formatBRL(calc.netProfit)}
                                </span>
                              </div>

                              {/* Linha 4: Estoque por tamanho */}
                              {stockData && (
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <span className="text-[10px] text-gray-400">Estoque:</span>
                                  {stockData.pieces && stockData.pieces.length > 0 ? (
                                    stockData.pieces.map((pc: any) => (
                                      <span key={pc.name} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600" title={pc.name}>
                                        {pc.name.split(" ").pop()}: {Object.keys(pc.sizes).join(",")}
                                      </span>
                                    ))
                                  ) : Object.keys(stockData.stock).length > 0 ? (
                                    Object.entries(stockData.stock).map(([size, qty]) => (
                                      <span key={size} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${qty > 0 ? (qty <= 5 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600") : "bg-red-50 text-red-400 line-through"}`}>
                                        {size}:{qty}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] font-bold text-red-400">Esgotado</span>
                                  )}
                                  {!stockData.pieces && (
                                    <span className={`text-[10px] font-bold ml-auto ${stockData.totalStock === 0 ? "text-red-400" : stockData.totalStock <= 10 ? "text-amber-500" : "text-emerald-500"}`}>
                                      Total: {stockData.totalStock}
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Modal de novo/editar produto */}
      {showProductForm && (
        <ProductFormModal
          product={editingCustomProduct}
          onSave={handleSaveProduct}
          onClose={() => { setShowProductForm(false); setEditingCustomProduct(null); }}
        />
      )}
    </>
  );
}
