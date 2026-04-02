"use client";

import { Product, PriceCalc, CATEGORY_LABELS } from "@/lib/types";
import { formatBRL } from "@/lib/pricing";
import { useCart } from "@/context/CartContext";
import { useCatalogData } from "@/context/CatalogDataContext";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import productInfoFile from "@/data/product-info.json";

const productInfoData = (productInfoFile as any).products || {};

// Tabela de medidas simplificada por tamanho
const SIZE_MEASURES: Record<string, string> = {
  P: "Busto 82-86 | Cintura 64-68 | Quadril 90-94",
  M: "Busto 86-90 | Cintura 68-72 | Quadril 94-98",
  G: "Busto 90-96 | Cintura 72-78 | Quadril 98-104",
  GG: "Busto 96-102 | Cintura 78-84 | Quadril 104-110",
};

function toSlug(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+c\/\s*/g, "-c-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

interface Props {
  product: Product;
  priceCalc: PriceCalc;
  onClose: () => void;
}

export function ProductDetailModal({ product, priceCalc, onClose }: Props) {
  const { addItem } = useCart();
  const { atacadoProducts } = useCatalogData();
  const [selectedSize, setSelectedSize] = useState("");
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [currentImg, setCurrentImg] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { atacado, info } = useMemo(() => {
    const slug = product.slug || toSlug(product.name);
    const at = atacadoProducts[slug] || Object.values(atacadoProducts).find(
      (d: any) => d.atacadoSlug?.replace(/-at$/, "") === slug || d.name === product.name
    );
    const inf = productInfoData[(at as any)?.atacadoSlug || ""] || productInfoData[slug + "-at"] || null;
    return { atacado: at as any, info: inf };
  }, [product, atacadoProducts]);
  const allImages: string[] = atacado?.images?.length > 0 ? atacado.images : product.img ? [product.img] : [];
  const stock: Record<string, number> = atacado?.stock || {};
  const totalStock: number = atacado?.totalStock ?? -1;
  const isSoldOut = totalStock > 0 ? false : (product.soldOut || totalStock === 0);
  const hasInfo = info && (info.description || info.composition);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, allImages.length - 1));
    setCurrentImg(clamped);
    scrollRef.current?.scrollTo({ left: clamped * scrollRef.current.offsetWidth, behavior: "smooth" });
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth);
    if (idx !== currentImg) setCurrentImg(idx);
  };

  // Mouse wheel → scroll horizontal na galeria
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!scrollRef.current || allImages.length <= 1) return;
    e.preventDefault();
    if (e.deltaY > 0 || e.deltaX > 0) {
      goTo(currentImg + 1);
    } else if (e.deltaY < 0 || e.deltaX < 0) {
      goTo(currentImg - 1);
    }
  }, [currentImg, allImages.length]);

  const handleAdd = () => {
    if (!selectedSize) return;
    addItem({ productId: product.id, name: product.name, size: selectedSize, quantity: 1, img: allImages[0] || product.img, category: product.category });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1500);
  };

  // ── Gallery component ──
  const Gallery = () => (
    <div className="relative w-full aspect-square lg:aspect-auto lg:h-full bg-gray-50">
      {allImages.length > 0 ? (
        <>
          <div ref={scrollRef} onScroll={handleScroll} onWheel={handleWheel} className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: "none" }}>
            {allImages.map((src, i) => (
              <img key={i} src={src} alt={`${product.name} - ${i + 1}`} loading="lazy" draggable={false} className="w-full h-full object-contain flex-shrink-0 snap-center bg-white select-none" />
            ))}
          </div>
          {allImages.length > 1 && currentImg > 0 && (
            <button onClick={() => goTo(currentImg - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg z-10">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          {allImages.length > 1 && currentImg < allImages.length - 1 && (
            <button onClick={() => goTo(currentImg + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg z-10">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
          {allImages.length > 1 && (
            <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-bold px-2.5 py-1 rounded-full">{currentImg + 1}/{allImages.length}</span>
          )}
          {/* Thumbnail strip (desktop only) */}
          {allImages.length > 1 && (
            <div className="hidden lg:flex absolute bottom-3 left-3 right-14 gap-1.5 overflow-x-auto">
              {allImages.slice(0, 8).map((src, i) => (
                <button key={i} onClick={() => goTo(i)} className={`flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 transition-all ${i === currentImg ? "border-brand-400 scale-110" : "border-white/60 opacity-70 hover:opacity-100"}`}>
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl font-black">
          {product.name.substring(0, 2).toUpperCase()}
        </div>
      )}
      {isSoldOut && <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">Esgotado</span>}
      {product.tags.includes("novidade") && !isSoldOut && <span className="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">Novo</span>}
    </div>
  );

  // ── Info panel ──
  const InfoPanel = () => (
    <div className="flex flex-col h-full">
      {/* Header - desktop only (mobile has it in the outer shell) */}
      <div className="hidden lg:block px-5 pt-5 pb-3 border-b border-gray-100">
        <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">{CATEGORY_LABELS[product.category]}</p>
        <h2 className="text-lg font-bold text-gray-800 leading-snug mt-0.5">{product.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 lg:px-5 py-4 space-y-4">
        {/* Pricing */}
        <div className="space-y-1">
          <p className="text-3xl font-black text-gray-800 leading-none">{formatBRL(Math.round(priceCalc.priceInstallment))}</p>
          <p className="text-xs text-gray-500">
            {priceCalc.installments}x de <span className="font-bold text-gray-700">{formatBRL(Math.round(priceCalc.installmentMonthly))}</span> sem juros
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">PIX</span>
            <span className="text-lg font-extrabold text-emerald-600">{formatBRL(Math.round(priceCalc.pricePix))}</span>
            <span className="text-[10px] text-emerald-500">({priceCalc.pixDiscount}% off)</span>
          </div>
        </div>

        {/* Size selector */}
        {!isSoldOut && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">Tamanho:</p>
            <div className="flex gap-1.5">
              {(Object.keys(stock).length > 0
                ? Object.entries(stock)
                : product.sizes.split(",").map((s) => [s.trim(), 1] as [string, number])
              ).map(([size, qty]) => (
                <button
                  key={size}
                  disabled={qty === 0}
                  onClick={() => setSelectedSize(size as string)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    qty === 0
                      ? "bg-gray-100 text-gray-300 cursor-not-allowed line-through"
                      : selectedSize === size
                      ? "bg-brand-400 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            {/* Medidas do tamanho selecionado */}
            {selectedSize && SIZE_MEASURES[selectedSize] && (
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
                {SIZE_MEASURES[selectedSize]} (cm)
              </p>
            )}
            <button
              disabled={!selectedSize}
              onClick={handleAdd}
              className={`w-full py-2.5 text-sm font-bold rounded-xl transition-all ${
                addedFeedback
                  ? "bg-emerald-500 text-white"
                  : selectedSize
                  ? "bg-brand-400 hover:bg-brand-500 text-white shadow-md"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {addedFeedback ? "Adicionado!" : selectedSize ? `Adicionar ${selectedSize} ao Carrinho` : "Selecione o tamanho"}
            </button>
          </div>
        )}

        {/* Details accordion */}
        {hasInfo && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between py-2 border-t border-gray-100 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Detalhes do produto
            </span>
            <svg className={`w-4 h-4 transition-transform ${showDetails ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {showDetails && info && (
          <div className="space-y-3 pb-2">
            {info.description && (
              <p className="text-sm text-gray-600 leading-relaxed">{info.description}</p>
            )}
            {info.modelInfo && (
              <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">{info.modelInfo}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {info.composition && (
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Composicao</p>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">{info.composition}</p>
                </div>
              )}
              {info.technology && (
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Tecnologia</p>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">{info.technology}</p>
                </div>
              )}
              {info.compression && (
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Compressao</p>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">{info.compression}</p>
                </div>
              )}
              {info.hasBraPad && (
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Entrada Bojo</p>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">{info.hasBraPad}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end lg:items-center justify-center lg:p-6" onClick={onClose}>
      <div className="bg-white rounded-t-2xl lg:rounded-2xl w-full lg:max-w-4xl max-h-[92vh] lg:max-h-[85vh] overflow-hidden shadow-2xl flex flex-col lg:flex-row" onClick={(e) => e.stopPropagation()}>

        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">{CATEGORY_LABELS[product.category]}</p>
            <h2 className="text-base font-bold text-gray-800 leading-snug truncate">{product.name}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl ml-2">&times;</button>
        </div>

        {/* Mobile: scrollable column */}
        <div className="lg:hidden flex-1 overflow-y-auto">
          <Gallery />
          <InfoPanel />
        </div>

        {/* Desktop: side by side */}
        <div className="hidden lg:flex lg:flex-row w-full h-full">
          {/* Left: gallery */}
          <div className="w-1/2 h-full">
            <Gallery />
          </div>
          {/* Right: info */}
          <div className="w-1/2 h-full border-l border-gray-100 relative">
            {/* Close button */}
            <button onClick={onClose} className="absolute top-3 right-3 z-20 w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl">&times;</button>
            <InfoPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
