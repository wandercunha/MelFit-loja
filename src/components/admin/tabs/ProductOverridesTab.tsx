"use client";

import { useState, useMemo, useRef } from "react";
import { useCatalog } from "@/context/CatalogContext";
import { PRODUCTS } from "@/data/products";
import { calcProduct, formatBRL, getAtacadoUrl } from "@/lib/pricing";

// Fecha admin e busca produto no catalogo
function goToProduct(name: string, setSearchQuery: (q: string) => void) {
  setSearchQuery(name);
  // Dispara evento para fechar o admin modal
  window.dispatchEvent(new CustomEvent("melfit:close-admin"));
}
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/types";
import scrapeMaps from "@/data/scrape-maps.json";

function normalizeName(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/c\/\s*/g, "c/ ")   // normaliza "c/Off" → "c/ off"
    .replace(/\s+/g, " ")
    .trim();
}

const retailPriceMap: Record<string, number> = {};
const priceMap = (scrapeMaps as { priceMap?: Record<string, number> }).priceMap || {};
const normalizedEntries = Object.entries(priceMap).map(([k, v]) => [normalizeName(k), v] as const);

// Palavras ignoradas no matching (artigos, preposicoes, etc)
const STOP_WORDS = new Set(["e", "de", "do", "da", "c/", "c", "com", "no", "na", "em"]);

// Extrai palavras significativas de um nome normalizado
function getKeywords(norm: string): string[] {
  return norm.split(" ").filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

// Score de similaridade entre dois conjuntos de palavras (0..1)
function wordScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const hits = a.filter((w) => setB.has(w)).length;
  return hits / Math.max(a.length, b.length);
}

// Busca preco varejo por nome — exato, parcial, ou fuzzy
function findRetailPrice(norm: string): number {
  // 1. Match exato
  const exact = normalizedEntries.find(([k]) => k === norm);
  if (exact) return exact[1];
  // 2. Match contem
  const partial = normalizedEntries.find(([k]) => k.includes(norm) || norm.includes(k));
  if (partial) return partial[1];
  // 3. Fuzzy por palavras-chave (min 60% overlap)
  const kw = getKeywords(norm);
  let best: { score: number; price: number } = { score: 0, price: 0 };
  for (const [k, v] of normalizedEntries) {
    if (v <= 0) continue;
    const score = wordScore(kw, getKeywords(k));
    if (score > best.score && score >= 0.6) {
      best = { score, price: v };
    }
  }
  return best.price;
}

for (const p of PRODUCTS) {
  const norm = normalizeName(p.name);

  // Conjuntos: tenta soma das pecas avulsas do varejo
  if (p.category === "conjuntos" && p.cost > 0) {
    const avulsos = PRODUCTS.filter((x) => x.category !== "conjuntos");
    const conjWords = new Set(getKeywords(norm));

    const pieceFits = (name: string) => {
      const words = getKeywords(normalizeName(name));
      if (!conjWords.has(words[0])) return false;
      const hits = words.filter((w) => conjWords.has(w)).length;
      return hits >= 2;
    };

    let found = false;
    for (const a of avulsos) {
      if (!pieceFits(a.name)) continue;
      const remainder = p.cost - a.cost;
      if (remainder <= 0) continue;
      const b = avulsos.find((x) => x.id !== a.id && x.cost === remainder && pieceFits(x.name));
      if (b) {
        const r1 = findRetailPrice(normalizeName(a.name));
        const r2 = findRetailPrice(normalizeName(b.name));
        if (r1 > 0 && r2 > 0) {
          retailPriceMap[p.name] = r1 + r2;
          found = true;
          break;
        }
      }
    }
    if (found) continue;

    // Fallback: busca conjunto direto no varejo (nome diferente, fuzzy match)
    const directPrice = findRetailPrice(norm);
    if (directPrice > 0) { retailPriceMap[p.name] = directPrice; continue; }

    // Nao achou nada — fica sem varejo
    continue;
  }

  const price = findRetailPrice(norm);
  if (price > 0) retailPriceMap[p.name] = price;
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

export function ProductOverridesTab() {
  const {
    globalSettings, overrides, setOverride, removeOverride,
    categoryOverrides, setCategoryOverride, removeCategoryOverride,
    productVisibility, setProductVisibility, isProductVisible,
    setSearchQuery,
    apiSecret,
  } = useCatalog();

  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<"margin" | "shipping">("margin");
  const [editMargin, setEditMargin] = useState(0);
  const [editShipping, setEditShipping] = useState(0);
  const [showOnlyOverrides, setShowOnlyOverrides] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  // Category edit state
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingCatField, setEditingCatField] = useState<"margin" | "shipping">("margin");
  const [editCatMargin, setEditCatMargin] = useState(0);
  const [editCatShipping, setEditCatShipping] = useState(0);

  // Image zoom state
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [zoomPos, setZoomPos] = useState<{ x: number; y: number } | null>(null);
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showZoom = (img: string, e: React.MouseEvent | React.TouchEvent) => {
    if (zoomTimer.current) clearTimeout(zoomTimer.current);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setZoomPos({ x: rect.right + 8, y: rect.top });
    setZoomImg(img);
  };
  const hideZoom = () => {
    zoomTimer.current = setTimeout(() => { setZoomImg(null); setZoomPos(null); }, 150);
  };
  const toggleZoom = (img: string, e: React.MouseEvent | React.TouchEvent) => {
    if (zoomImg === img) { setZoomImg(null); setZoomPos(null); }
    else showZoom(img, e);
  };

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

  // Dialog state
  const [dialog, setDialog] = useState<DialogConfig | null>(null);

  const [showDisabled, setShowDisabled] = useState(false);

  const products = useMemo(() => {
    let list = [...PRODUCTS];
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
  }, [filter, showOnlyOverrides, overrides, showDisabled, productVisibility]);

  // Group by category
  const groupedProducts = useMemo(() => {
    const groups: Record<string, typeof products> = {};
    for (const p of products) {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }
    return CATEGORY_ORDER
      .filter((cat) => groups[cat] && groups[cat].length > 0)
      .map((cat) => ({ category: cat, products: groups[cat] }));
  }, [products]);

  const overrideCount = Object.keys(overrides).length;
  const catOverrideCount = Object.keys(categoryOverrides).length;
  const disabledCount = PRODUCTS.filter((p) => !isProductVisible(p.id, p.soldOut)).length;

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
    const p = PRODUCTS.find((x) => x.id === productId);
    const catOv = p ? categoryOverrides[p.category] : undefined;
    setEditMargin(ov?.margin ?? catOv?.margin ?? globalSettings.margin);
    setEditShipping(ov?.shipping ?? catOv?.shipping ?? globalSettings.shipping);
    setEditingId(productId);
    setEditingField(field);
    setEditingCat(null);
  };

  const saveMargin = (productId: number) => {
    const ov = overrides[productId];
    setOverride(productId, { margin: editMargin, shipping: ov?.shipping });
    setEditingId(null);
  };

  const saveShipping = (productId: number) => {
    const ov = overrides[productId];
    setOverride(productId, { margin: ov?.margin, shipping: editShipping });
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
        onMouseEnter={(e) => showZoom(img, e)}
        onMouseLeave={hideZoom}
        onClick={(e) => toggleZoom(img, e)}
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
  ) => (
    <div
      className="absolute top-full right-0 mt-1.5 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-48 space-y-2.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={popoverKeyDown}
    >
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
        className="w-full px-2 py-1.5 text-sm border rounded-lg text-right"
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
      {dialog && <ConfirmDialog config={dialog} onCancel={() => setDialog(null)} />}

      {/* Image zoom preview */}
      {zoomImg && (
        <div
          className="fixed z-[150] pointer-events-none"
          style={zoomPos ? {
            left: Math.min(zoomPos.x, (typeof window !== "undefined" ? window.innerWidth - 220 : 500)),
            top: Math.max(8, Math.min(zoomPos.y - 40, (typeof window !== "undefined" ? window.innerHeight - 220 : 500))),
          } : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
        >
          <img
            src={zoomImg}
            alt=""
            className="w-48 h-48 rounded-xl object-cover shadow-2xl border-2 border-white ring-1 ring-black/10"
          />
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
          <div className="flex gap-2">
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
              <div key={category} className="rounded-xl border border-gray-200 overflow-hidden">
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
                        <th className="text-left px-3 py-1.5">Produto</th>
                        <th className="text-right px-3 py-1.5">Custo</th>
                        <th className="text-right px-3 py-1.5">Margem</th>
                        <th className="text-right px-3 py-1.5">Frete</th>
                        <th className="text-right px-3 py-1.5">
                          <span className="group/varejo relative cursor-help">
                            Varejo
                            <span className="inline-flex items-center justify-center w-3 h-3 ml-0.5 rounded-full bg-gray-200 text-gray-400 text-[8px] font-bold align-middle">?</span>
                            <span className="absolute top-full right-0 mt-1 hidden group-hover/varejo:block z-50 w-52 bg-gray-900 text-white text-[11px] font-normal normal-case tracking-normal rounded-lg px-3 py-2 shadow-xl leading-relaxed">
                              Preco no site de varejo (floraamar.com.br).
                              <span className="block mt-1 text-emerald-400">-X% = seu preco esta abaixo</span>
                              <span className="block text-red-400">+X% = seu preco esta acima</span>
                            </span>
                          </span>
                        </th>
                        <th className="text-right px-3 py-1.5">Cartao</th>
                        <th className="text-right px-3 py-1.5">PIX</th>
                        <th className="text-right px-3 py-1.5">Lucro</th>
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
                                    className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 flex flex-col gap-1 bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-xl whitespace-nowrap min-w-[200px]"
                                    onMouseEnter={() => showTooltip(p.id)}
                                    onMouseLeave={hideTooltip}
                                  >
                                    <button onClick={() => goToProduct(p.name, setSearchQuery)} className="flex items-center gap-1.5 hover:text-brand-300">
                                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                      Ver no catalogo
                                    </button>
                                    <a href={getAtacadoUrl(p)} className="flex items-center gap-1.5 hover:text-brand-300" target="_blank" rel="noopener noreferrer">
                                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                      Fornecedor (atacado)
                                    </a>
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
                                const retail = retailPriceMap[p.name];
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
                              <button
                                onClick={() => setProductVisibility(p.id, !visible)}
                                className={`w-9 h-5 rounded-full relative transition-colors inline-flex items-center ${visible ? "bg-emerald-400" : "bg-gray-300"}`}
                                title={visible ? "Desativar produto" : "Ativar produto"}
                              >
                                <span className={`inline-block w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${visible ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                              </button>
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
                      const retail = retailPriceMap[p.name];
                      const myPrice = Math.round(calc.priceInstallment);
                      const retailDiff = retail ? ((myPrice - retail) / retail * 100).toFixed(0) : null;

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
                            <p className="flex-1 text-sm font-semibold text-gray-800 leading-snug min-w-0">
                              {hasOverride && <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-400 mr-1 align-middle" />}
                              {p.name}
                            </p>
                            {isEditing ? (
                              <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => { setOverride(p.id, { margin: editMargin, shipping: editShipping }); setEditingId(null); }} className="text-[11px] px-2 py-1 bg-emerald-500 text-white rounded-lg font-semibold">Salvar</button>
                                <button onClick={() => setEditingId(null)} className="text-[11px] px-2 py-1 bg-gray-200 text-gray-600 rounded-lg">X</button>
                              </div>
                            ) : (
                              <button onClick={() => startEdit(p.id, "margin")} className="flex-shrink-0 text-[11px] px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg font-medium">Editar</button>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500">Margem %</label>
                                <input type="text" inputMode="decimal" value={editMargin || ""} onChange={(e) => { const v = parseFloat(e.target.value); setEditMargin(isNaN(v) ? 0 : v); }} onFocus={(e) => e.target.select()} className="w-full px-2 py-1.5 border rounded-lg text-sm text-right" />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500">Frete R$</label>
                                <input type="text" inputMode="decimal" value={editShipping || ""} onChange={(e) => { const v = parseFloat(e.target.value); setEditShipping(isNaN(v) ? 0 : v); }} onFocus={(e) => e.target.select()} className="w-full px-2 py-1.5 border rounded-lg text-sm text-right" />
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
    </>
  );
}
