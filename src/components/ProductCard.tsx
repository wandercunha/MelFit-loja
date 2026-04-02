"use client";

import { Product, PriceCalc, CATEGORY_LABELS } from "@/lib/types";
import { formatBRL, getColorFromName, getInitials, getAtacadoUrl } from "@/lib/pricing";
import { useCatalog } from "@/context/CatalogContext";
import { useCatalogData } from "@/context/CatalogDataContext";
import { useCart } from "@/context/CartContext";
import { useState, useRef, useMemo, useCallback } from "react";

const SIZE_MEASURES: Record<string, string> = {
  P: "Busto 82-86 | Cintura 64-68 | Quadril 90-94",
  M: "Busto 86-90 | Cintura 68-72 | Quadril 94-98",
  G: "Busto 90-96 | Cintura 72-78 | Quadril 98-104",
  GG: "Busto 96-102 | Cintura 78-84 | Quadril 104-110",
};
import productDetailsData from "@/data/product-details.json";
import { ProductDetailModal } from "./ProductDetailModal";

const SIZE_CHART_URL =
  "https://cdn.sistemawbuy.com.br/arquivos/97065044c3a1a212e5c7a4f183fed028/tabelas/template-duvidas-frequentes-3-697cfa2dd7aa71.png";

const details = (productDetailsData as any).products as Record<
  string,
  {
    images?: string[];
    sizeChart: string;
    stock: Record<string, number>;
    totalStock: number;
  }
>;

/** Gera slug a partir do nome do produto */
function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+c\/\s*/g, "-c-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

interface Props {
  product: Product;
  priceCalc: PriceCalc;
  hasOverride: boolean;
  onEdit: () => void;
}

export function ProductCard({ product, priceCalc, hasOverride, onEdit }: Props) {
  const { isAdmin } = useCatalog();
  const { atacadoProducts } = useCatalogData();
  const { addItem } = useCart();
  const color = getColorFromName(product.name);
  const [imgError, setImgError] = useState(false);
  const [currentImg, setCurrentImg] = useState(0);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const detail = useMemo(() => {
    const slug = product.slug || toSlug(product.name);

    const atacado = atacadoProducts[slug]
      || Object.values(atacadoProducts).find((d: any) => d.atacadoSlug?.replace(/-at$/, "") === slug || d.name === product.name);

    const varejo = details[slug]
      || Object.values(details).find((_, i) => { const k = Object.keys(details)[i]; return k.includes(slug) || slug.includes(k); })
      || null;

    if (!atacado && !varejo) return null;

    return {
      images: ((atacado as any)?.images || []) as string[],
      sizeChart: varejo?.sizeChart || "",
      stock: ((atacado as any)?.stock || varejo?.stock || {}) as Record<string, number>,
      totalStock: ((atacado as any)?.totalStock ?? varejo?.totalStock ?? -1) as number,
    };
  }, [product, atacadoProducts]);
  const allImages =
    detail?.images && detail.images.length > 0
      ? detail.images
      : product.img
      ? [product.img]
      : [];
  const hasMultiple = allImages.length > 1;
  const stock = detail?.stock || {};
  const totalStock = detail?.totalStock ?? -1; // -1 = unknown
  // Atacado stock > 0 sobrescreve soldOut hardcoded do products.ts
  const isSoldOut = totalStock > 0 ? false : (product.soldOut || totalStock === 0);

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, allImages.length - 1));
    setCurrentImg(clamped);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: clamped * scrollRef.current.offsetWidth,
        behavior: "smooth",
      });
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, offsetWidth } = scrollRef.current;
    const idx = Math.round(scrollLeft / offsetWidth);
    if (idx !== currentImg) setCurrentImg(idx);
  };

  // Distinguir tap/click de swipe/drag (funciona em mobile e desktop)
  const pointerStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, []);
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointerStart.current || isAdmin) return;
    const dx = Math.abs(e.clientX - pointerStart.current.x);
    const dy = Math.abs(e.clientY - pointerStart.current.y);
    const dt = Date.now() - pointerStart.current.t;
    pointerStart.current = null;
    // Tap/click: pouco movimento (<10px) e rápido (<400ms)
    if (dx < 10 && dy < 10 && dt < 400) {
      setShowDetail(true);
    }
  }, [isAdmin]);

  return (
    <>
      <div className="card overflow-hidden group">
        {/* Image Carousel */}
        <div
          className={`relative w-full aspect-[3/4] overflow-hidden ${!isAdmin ? "cursor-pointer" : ""}`}
          style={{
            background: `linear-gradient(135deg, ${color}15, ${color}30)`,
          }}
        >
          {allImages.length > 0 && !imgError ? (
            <>
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {allImages.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`${product.name} - foto ${i + 1}`}
                    loading="lazy"
                    onError={() => i === 0 && setImgError(true)}
                    className="w-full h-full object-cover flex-shrink-0 snap-center pointer-events-none select-none"
                    draggable={false}
                  />
                ))}
              </div>

              {/* Arrow buttons (visible on hover for PC) */}
              {hasMultiple && currentImg > 0 && (
                <button
                  onClick={() => goTo(currentImg - 1)}
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              {hasMultiple && currentImg < allImages.length - 1 && (
                <button
                  onClick={() => goTo(currentImg + 1)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {/* Dots indicator */}
              {hasMultiple && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 pointer-events-none">
                  {allImages.slice(0, 8).map((_, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        i === currentImg
                          ? "bg-white shadow-md scale-125"
                          : "bg-white/50"
                      }`}
                    />
                  ))}
                  {allImages.length > 8 && (
                    <span className="text-white text-[8px] font-bold">+{allImages.length - 8}</span>
                  )}
                </div>
              )}

              {/* Photo count badge */}
              {hasMultiple && (
                <span className="absolute bottom-2 right-2 bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {currentImg + 1}/{allImages.length}
                </span>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span
                className="text-4xl font-black opacity-20"
                style={{ color }}
              >
                {getInitials(product.name)}
              </span>
            </div>
          )}

          {/* Stock badge */}
          {isSoldOut ? (
            <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Esgotado
            </span>
          ) : totalStock > 0 && totalStock <= 10 ? (
            <span className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Ultimas {totalStock}
            </span>
          ) : null}

          {product.tags.includes("novidade") && !isSoldOut && !isAdmin && (
            <span className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
              Novo
            </span>
          )}

          {isAdmin && (
            <button
              onClick={onEdit}
              className="absolute top-3 right-3 bg-brand-400 text-white w-9 h-9 rounded-full flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg hover:bg-brand-500 hover:scale-110"
              title="Editar margem"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1">
            {CATEGORY_LABELS[product.category]}
          </p>
          <h3
            className={`font-semibold text-sm text-gray-800 leading-snug mb-1.5 ${!isAdmin ? "cursor-pointer hover:text-brand-500 transition-colors" : ""}`}
            onClick={() => !isAdmin && setShowDetail(true)}
          >
            {product.name}
          </h3>

          {/* Sizes with stock */}
          <div className="flex items-center gap-1 mb-3 flex-wrap">
            {Object.keys(stock).length > 0
              ? Object.entries(stock).map(([size, qty]) => (
                  <span
                    key={size}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      qty > 0
                        ? "bg-gray-100 text-gray-600"
                        : "bg-red-50 text-red-400 line-through"
                    }`}
                    title={`${size}: ${qty} em estoque`}
                  >
                    {size}
                  </span>
                ))
              : <p className="text-xs text-gray-400">Tam: {product.sizes}</p>
            }
            {/* Size chart button */}
            {(detail?.stock && Object.keys(detail.stock).length > 0) && (
              <button
                onClick={() => setShowSizeChart(true)}
                className="text-[10px] font-bold text-blue-500 hover:text-blue-700 ml-auto"
                title="Ver tabela de medidas"
              >
                <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                </svg>
              </button>
            )}
          </div>

          {/* === CLIENT VIEW === */}
          {!isAdmin && (
            <div className="space-y-1.5">
              {/* Preço em destaque */}
              <p className="text-2xl sm:text-3xl font-black text-gray-800 leading-none">
                {formatBRL(Math.round(priceCalc.priceInstallment))}
              </p>

              {/* Parcelamento */}
              <p className="text-[11px] sm:text-xs text-gray-500">
                {priceCalc.installments}x de{" "}
                <span className="font-bold text-gray-700">
                  {formatBRL(Math.round(priceCalc.installmentMonthly))}
                </span>{" "}
                sem juros
              </p>

              {/* PIX */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] sm:text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                  PIX
                </span>
                <span className="text-sm sm:text-base font-extrabold text-emerald-600">
                  {formatBRL(Math.round(priceCalc.pricePix))}
                </span>
                <span className="text-[9px] sm:text-[10px] text-emerald-500">
                  ({priceCalc.pixDiscount}% off)
                </span>
              </div>

              {/* Add to cart */}
              {!isSoldOut && (
                <div className="pt-2 space-y-1.5">
                  {/* Size selector */}
                  <div className="flex gap-1">
                    {(Object.keys(stock).length > 0
                      ? Object.entries(stock)
                      : product.sizes.split(",").map((s) => [s.trim(), 1] as [string, number])
                    ).map(([size, qty]) => (
                      <button
                        key={size}
                        disabled={qty === 0}
                        onClick={() => setSelectedSize(size as string)}
                        className={`flex-1 py-1 text-[10px] sm:text-xs font-bold rounded transition-colors ${
                          qty === 0
                            ? "bg-gray-100 text-gray-300 cursor-not-allowed line-through"
                            : selectedSize === size
                            ? "bg-brand-400 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  {/* Medidas do tamanho selecionado */}
                  {selectedSize && SIZE_MEASURES[selectedSize] && (
                    <p className="text-[10px] text-gray-400 leading-tight">
                      {SIZE_MEASURES[selectedSize]}
                    </p>
                  )}
                  <button
                    disabled={!selectedSize}
                    onClick={() => {
                      if (!selectedSize) return;
                      addItem({
                        productId: product.id,
                        name: product.name,
                        size: selectedSize,
                        quantity: 1,
                        img: allImages[0] || product.img,
                        category: product.category,
                      });
                      setAddedFeedback(true);
                      setTimeout(() => setAddedFeedback(false), 1500);
                    }}
                    className={`w-full py-2 text-xs font-bold rounded-lg transition-all ${
                      addedFeedback
                        ? "bg-emerald-500 text-white"
                        : selectedSize
                        ? "bg-brand-400 hover:bg-brand-500 text-white"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {addedFeedback
                      ? "Adicionado!"
                      : selectedSize
                      ? `Adicionar ${selectedSize} ao Carrinho`
                      : "Selecione o tamanho"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* === ADMIN VIEW === */}
          {isAdmin && (
            <div className="space-y-1">
              <p className="text-xs text-gray-400 line-through">
                Custo: {formatBRL(priceCalc.cost)}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-extrabold text-brand-500">
                  {formatBRL(Math.round(priceCalc.priceInstallment))}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  +{priceCalc.appliedMargin}%{hasOverride ? " *" : ""}
                </span>
              </div>
              <div className="text-[11px] text-gray-400 space-y-0.5">
                <p>PIX: {formatBRL(Math.round(priceCalc.pricePix))} | {priceCalc.installments}x: {formatBRL(Math.round(priceCalc.installmentMonthly))}</p>
                <p>
                  Lucro: {formatBRL(priceCalc.netProfit)} | Margem: {priceCalc.netMargin.toFixed(1)}%
                </p>
              </div>
              <a
                href={getAtacadoUrl(product)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-500 hover:underline mt-0.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Ver no fornecedor
              </a>
              {totalStock >= 0 && (
                <p className={`text-[10px] font-semibold ${totalStock === 0 ? "text-red-500" : totalStock <= 10 ? "text-amber-500" : "text-emerald-500"}`}>
                  Estoque fabricante: {totalStock} un
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Size Chart Modal */}
      {showSizeChart && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setShowSizeChart(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 w-full sm:max-w-lg shadow-2xl max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 pr-2 leading-tight">
                Tabela de Medidas
              </h3>
              <button
                onClick={() => setShowSizeChart(false)}
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">{product.name}</p>
            <img
              src={SIZE_CHART_URL}
              alt="Tabela de medidas"
              className="w-full rounded-lg"
            />
            {Object.keys(stock).length > 0 && (
              <div className="mt-3 flex gap-2 justify-center flex-wrap">
                {Object.entries(stock).map(([size, qty]) => (
                  <div
                    key={size}
                    className={`text-center px-3 py-1.5 rounded-lg min-w-[50px] ${
                      qty > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-400"
                    }`}
                  >
                    <p className="text-sm font-bold">{size}</p>
                    <p className="text-[10px]">{qty > 0 ? `${qty} un` : "esgotado"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {showDetail && !isAdmin && (
        <ProductDetailModal
          product={product}
          priceCalc={priceCalc}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
}
