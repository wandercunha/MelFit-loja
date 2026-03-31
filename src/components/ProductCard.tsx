"use client";

import { Product, PriceCalc, CATEGORY_LABELS } from "@/lib/types";
import { formatBRL, getColorFromName, getInitials } from "@/lib/pricing";
import { useCatalog } from "@/context/CatalogContext";
import { useState, useRef, useEffect } from "react";
import productDetailsData from "@/data/product-details.json";

const details = (productDetailsData as any).products as Record<
  string,
  {
    images: string[];
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

/** Busca detalhes por slug (tenta variações) */
function getDetail(product: Product) {
  const slug = product.slug || toSlug(product.name);
  if (details[slug]) return details[slug];
  // Tenta encontrar por prefixo
  for (const key of Object.keys(details)) {
    if (key.includes(slug) || slug.includes(key)) return details[key];
  }
  return null;
}

interface Props {
  product: Product;
  priceCalc: PriceCalc;
  hasOverride: boolean;
  onEdit: () => void;
}

export function ProductCard({ product, priceCalc, hasOverride, onEdit }: Props) {
  const { isAdmin } = useCatalog();
  const color = getColorFromName(product.name);
  const [imgError, setImgError] = useState(false);
  const [currentImg, setCurrentImg] = useState(0);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const detail = getDetail(product);
  const allImages =
    detail?.images && detail.images.length > 0
      ? detail.images
      : product.img
      ? [product.img]
      : [];
  const hasMultiple = allImages.length > 1;
  const stock = detail?.stock || {};
  const totalStock = detail?.totalStock ?? -1; // -1 = unknown

  // Sync scroll position with currentImg
  useEffect(() => {
    if (scrollRef.current && hasMultiple) {
      const container = scrollRef.current;
      const width = container.offsetWidth;
      container.scrollTo({ left: currentImg * width, behavior: "smooth" });
    }
  }, [currentImg, hasMultiple]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, offsetWidth } = scrollRef.current;
    const idx = Math.round(scrollLeft / offsetWidth);
    if (idx !== currentImg) setCurrentImg(idx);
  };

  return (
    <>
      <div className="card overflow-hidden group">
        {/* Image Carousel */}
        <div
          className="relative w-full aspect-[3/4] overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${color}15, ${color}30)`,
          }}
        >
          {allImages.length > 0 && !imgError ? (
            <>
              <div
                ref={scrollRef}
                onScroll={handleScroll}
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
                    className="w-full h-full object-cover flex-shrink-0 snap-center"
                  />
                ))}
              </div>

              {/* Dots indicator */}
              {hasMultiple && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 pointer-events-none">
                  {allImages.map((_, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        i === currentImg
                          ? "bg-white shadow-md scale-125"
                          : "bg-white/50"
                      }`}
                    />
                  ))}
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
          {product.soldOut || totalStock === 0 ? (
            <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Esgotado
            </span>
          ) : totalStock > 0 && totalStock <= 10 ? (
            <span className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Ultimas {totalStock}
            </span>
          ) : null}

          {product.tags.includes("novidade") && !product.soldOut && !isAdmin && (
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
          <h3 className="font-semibold text-sm text-gray-800 leading-snug mb-1.5">
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
            {detail?.sizeChart && (
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
              <div className="bg-emerald-50 rounded-lg px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-bold text-emerald-700 bg-emerald-200 px-1 sm:px-1.5 py-0.5 rounded">PIX</span>
                  <span className="text-base sm:text-lg font-extrabold text-emerald-700">
                    {formatBRL(priceCalc.pricePix)}
                  </span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-emerald-600 mt-0.5">
                  {priceCalc.pixDiscount}% de desconto
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] sm:text-[10px] font-semibold text-gray-400">Cartao:</span>
                <span className="text-xs sm:text-sm font-bold text-gray-700">
                  {formatBRL(priceCalc.priceCard)}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[9px] sm:text-[10px] font-semibold text-gray-400">Parcelado:</span>
                <span className="text-xs sm:text-sm font-bold text-brand-500">
                  {priceCalc.installments}x {formatBRL(priceCalc.installmentMonthly)}
                </span>
              </div>
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
                  {formatBRL(priceCalc.priceCard)}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  +{priceCalc.appliedMargin}%{hasOverride ? " *" : ""}
                </span>
              </div>
              <div className="text-[11px] text-gray-400 space-y-0.5">
                <p>PIX: {formatBRL(priceCalc.pricePix)} | Parc: {formatBRL(priceCalc.priceInstallment)}</p>
                <p>
                  Lucro: {formatBRL(priceCalc.netProfit)} | Margem: {priceCalc.netMargin.toFixed(1)}%
                </p>
              </div>
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
      {showSizeChart && detail?.sizeChart && (
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
              src={detail.sizeChart}
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
    </>
  );
}
