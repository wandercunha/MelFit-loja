"use client";

import { Product, PriceCalc, CATEGORY_LABELS } from "@/lib/types";
import { formatBRL } from "@/lib/pricing";
import { useCart } from "@/context/CartContext";
import { useState, useRef, useEffect } from "react";
import atacadoDetailsData from "@/data/atacado-details.json";
import productInfoFile from "@/data/product-info.json";

const productInfoData = (productInfoFile as any).products || {};

const atacadoProducts = (atacadoDetailsData as any).products as Record<
  string,
  { name: string; atacadoSlug: string; images: string[]; stock: Record<string, number>; totalStock: number }
>;

function toSlug(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+c\/\s*/g, "-c-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function getProductData(product: Product) {
  const slug = product.slug || toSlug(product.name);
  // Busca no atacado-details
  const atacado = atacadoProducts[slug] || Object.values(atacadoProducts).find(
    (d) => d.atacadoSlug?.replace(/-at$/, "") === slug || d.name === product.name
  );
  // Busca info (descricao, composicao)
  const info = productInfoData[atacado?.atacadoSlug || ""] || productInfoData[slug + "-at"] || null;
  return { atacado, info };
}

interface Props {
  product: Product;
  priceCalc: PriceCalc;
  onClose: () => void;
}

export function ProductDetailModal({ product, priceCalc, onClose }: Props) {
  const { addItem } = useCart();
  const [selectedSize, setSelectedSize] = useState("");
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [currentImg, setCurrentImg] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { atacado, info } = getProductData(product);
  const allImages = atacado?.images?.length > 0
    ? atacado.images
    : product.img ? [product.img] : [];
  const stock = atacado?.stock || {};
  const totalStock = atacado?.totalStock ?? -1;

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // ESC fecha
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, allImages.length - 1));
    setCurrentImg(clamped);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: clamped * scrollRef.current.offsetWidth, behavior: "smooth" });
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth);
    if (idx !== currentImg) setCurrentImg(idx);
  };

  const handleAdd = () => {
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
  };

  const isSoldOut = product.soldOut || totalStock === 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">{CATEGORY_LABELS[product.category]}</p>
            <h2 className="text-base font-bold text-gray-800 leading-snug truncate">{product.name}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl ml-2">
            &times;
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Image gallery */}
          <div className="relative w-full aspect-square sm:aspect-[4/3] bg-gray-50">
            {allImages.length > 0 ? (
              <>
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                  style={{ scrollbarWidth: "none" }}
                >
                  {allImages.map((src, i) => (
                    <img key={i} src={src} alt={`${product.name} - ${i + 1}`} loading="lazy" className="w-full h-full object-contain flex-shrink-0 snap-center bg-white" />
                  ))}
                </div>

                {/* Arrows */}
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

                {/* Counter */}
                {allImages.length > 1 && (
                  <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    {currentImg + 1}/{allImages.length}
                  </span>
                )}

                {/* Dots */}
                {allImages.length > 1 && allImages.length <= 10 && (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                    {allImages.map((_, i) => (
                      <span key={i} className={`w-2 h-2 rounded-full transition-all ${i === currentImg ? "bg-white shadow scale-125" : "bg-white/40"}`} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl font-black">
                {product.name.substring(0, 2).toUpperCase()}
              </div>
            )}

            {/* Badges */}
            {isSoldOut && (
              <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">Esgotado</span>
            )}
            {product.tags.includes("novidade") && !isSoldOut && (
              <span className="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">Novo</span>
            )}
          </div>

          {/* Pricing */}
          <div className="px-4 pt-4 pb-2 space-y-1.5">
            <p className="text-3xl font-black text-gray-800 leading-none">
              {formatBRL(Math.round(priceCalc.priceInstallment))}
            </p>
            <p className="text-xs text-gray-500">
              {priceCalc.installments}x de{" "}
              <span className="font-bold text-gray-700">{formatBRL(Math.round(priceCalc.installmentMonthly))}</span>{" "}
              sem juros
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">PIX</span>
              <span className="text-lg font-extrabold text-emerald-600">{formatBRL(Math.round(priceCalc.pricePix))}</span>
              <span className="text-[10px] text-emerald-500">({priceCalc.pixDiscount}% off)</span>
            </div>
          </div>

          {/* Size selector + Add to cart */}
          {!isSoldOut && (
            <div className="px-4 pb-4 space-y-2">
              <p className="text-xs font-semibold text-gray-600">Tamanho:</p>
              <div className="flex gap-2">
                {(Object.keys(stock).length > 0
                  ? Object.entries(stock)
                  : product.sizes.split(",").map((s) => [s.trim(), 1] as [string, number])
                ).map(([size, qty]) => (
                  <button
                    key={size}
                    disabled={qty === 0}
                    onClick={() => setSelectedSize(size as string)}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                      qty === 0
                        ? "bg-gray-100 text-gray-300 cursor-not-allowed line-through"
                        : selectedSize === size
                        ? "bg-brand-400 text-white shadow-md scale-105"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {size}
                    {qty > 0 && qty <= 5 && <span className="block text-[9px] font-normal opacity-70">{qty} left</span>}
                  </button>
                ))}
              </div>
              <button
                disabled={!selectedSize}
                onClick={handleAdd}
                className={`w-full py-3 text-sm font-bold rounded-xl transition-all ${
                  addedFeedback
                    ? "bg-emerald-500 text-white scale-[0.98]"
                    : selectedSize
                    ? "bg-brand-400 hover:bg-brand-500 text-white shadow-md"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {addedFeedback ? "Adicionado ao carrinho!" : selectedSize ? `Adicionar ${selectedSize} ao Carrinho` : "Selecione o tamanho"}
              </button>
            </div>
          )}

          {/* Product info (descricao, composicao, etc) */}
          {info && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-4">
              {info.description && (
                <div>
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Detalhes</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{info.description}</p>
                </div>
              )}
              {info.modelInfo && (
                <div>
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Modelo</h4>
                  <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">{info.modelInfo}</p>
                </div>
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

          {/* Fallback: mostrar specs basicas mesmo sem product-info */}
          {!info && (
            <div className="px-4 pb-4 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400">Detalhes do produto serao adicionados em breve.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
