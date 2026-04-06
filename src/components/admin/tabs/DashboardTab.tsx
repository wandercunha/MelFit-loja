"use client";

import { useMemo, useState, useCallback } from "react";
import { useCatalog } from "@/context/CatalogContext";
import { useCatalogData } from "@/context/CatalogDataContext";
import { PRODUCTS } from "@/data/products";
import { Product, Category } from "@/lib/types";
import { calcProduct, formatBRL } from "@/lib/pricing";
import { ExportButton } from "@/components/ExportButton";

export function DashboardTab() {
  const { globalSettings, overrides, categoryOverrides, isProductVisible } = useCatalog();
  const { updatedAt, dataSource, atacadoProducts, atacadoByName, allProducts, addCustomProduct } = useCatalogData();
  const [showCatalogAlerts, setShowCatalogAlerts] = useState(true);
  const [addingProduct, setAddingProduct] = useState<string | null>(null);
  const [linkingUrl, setLinkingUrl] = useState<Record<string, string>>({});
  const [linkingStatus, setLinkingStatus] = useState<Record<string, string>>({});

  const available = allProducts.filter((p) => isProductVisible(p.id, p.soldOut));

  // Alerta se scrape não rodou há mais de 36h
  const hoursAgo = updatedAt ? (Date.now() - new Date(updatedAt).getTime()) / 3600000 : Infinity;
  const scrapeStale = hoursAgo > 36;
  let totalCost = 0;
  let totalSell = 0;
  let totalProfit = 0;
  available.forEach((p) => {
    const c = calcProduct(p, globalSettings, overrides[p.id], categoryOverrides[p.category]);
    totalCost += c.totalCost;
    totalSell += c.priceCard;
    totalProfit += c.netProfit;
  });

  // Comparar catalogo com atacado (scrape) para detectar novidades/removidos
  const toSlug = (name: string) =>
    name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+c\/\s*/g, "-c-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  // Mapa de categorias do atacado para as nossas
  const ATACADO_CATEGORY_MAP: Record<string, Category> = {
    tops: "tops", shorts: "shorts", leggings: "leggings",
    macaquinhos: "macaquinhos", macacoes: "macacoes", conjuntos: "conjuntos",
    "colecao-exclusiva": "tops", novidade: "tops",
  };

  interface NewProductInfo { name: string; slug: string; cost: number; category: Category; img: string }

  const catalogAlerts = useMemo(() => {
    const atacadoNames = new Set<string>();
    const atacadoSlugs = new Set<string>();
    for (const [slug, p] of Object.entries(atacadoProducts)) {
      atacadoSlugs.add(slug);
      if ((p as any).name) atacadoNames.add((p as any).name);
    }

    // Produtos no fornecedor que NÃO estão no nosso catálogo
    const newProducts: NewProductInfo[] = [];
    for (const [slug, p] of Object.entries(atacadoProducts)) {
      const at = p as any;
      if (!at.name) continue;
      const inCatalog = allProducts.some((cp) => {
        const cpSlug = cp.slug || toSlug(cp.name);
        return cpSlug === slug || cp.name === at.name || atacadoByName[cp.name]?._slug === slug;
      });
      if (!inCatalog) {
        // Inferir categoria do slug do atacado
        let cat: Category = "tops";
        const slugLower = (at.atacadoSlug || slug).toLowerCase();
        if (slugLower.includes("conjunto") || at.pieces?.length > 0) cat = "conjuntos";
        else if (slugLower.includes("short") || slugLower.includes("run")) cat = "shorts";
        else if (slugLower.includes("legging") || slugLower.includes("flare")) cat = "leggings";
        else if (slugLower.includes("macaquinho") || slugLower.includes("move")) cat = "macaquinhos";
        else if (slugLower.includes("macacao") || slugLower.includes("essential")) cat = "macacoes";

        newProducts.push({
          name: at.name,
          slug,
          cost: at.price || 0,
          category: cat,
          img: at.images?.[0] || "",
        });
      }
    }

    // Produtos no nosso catálogo que sumiram do fornecedor
    const missing: string[] = [];
    for (const p of allProducts) {
      const slug = p.slug || toSlug(p.name);
      const found = atacadoSlugs.has(slug) || atacadoNames.has(p.name) || !!atacadoByName[p.name];
      if (!found) missing.push(p.name);
    }

    return { newProducts, missing };
  }, [atacadoProducts, atacadoByName, allProducts]);

  const handleAddProduct = useCallback(async (np: NewProductInfo) => {
    setAddingProduct(np.name);
    // Gerar ID único (maior ID existente + 1)
    const maxId = allProducts.reduce((max, p) => Math.max(max, p.id), 0);
    const product: Product = {
      id: maxId + 1,
      name: np.name,
      cost: np.cost,
      category: np.category,
      tags: [],
      sizes: "P, M, G",
      img: np.img,
      slug: np.slug,
    };
    await addCustomProduct(product);
    setAddingProduct(null);
  }, [allProducts, addCustomProduct]);

  // Vincular URL do atacado para produto não encontrado
  const handleLinkUrl = useCallback(async (productName: string) => {
    const url = linkingUrl[productName]?.trim();
    if (!url) return;

    // Extrair slug da URL: https://www.floraamaratacado.com.br/short-run-preto-at/ → short-run-preto-at
    const match = url.match(/floraamaratacado\.com\.br\/([a-z0-9-]+)\/?/);
    if (!match) {
      setLinkingStatus((s) => ({ ...s, [productName]: "URL invalida" }));
      return;
    }

    const atacadoSlug = match[1];
    setLinkingStatus((s) => ({ ...s, [productName]: "Salvando..." }));

    try {
      // Salvar override no Turso via settings
      const session = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("melfit_session") || "{}") : {};

      // Ler overrides atuais do banco
      const res = await fetch("/api/settings", { headers: { Authorization: `Bearer ${session.apiSecret}` } });
      const settings = await res.json();
      const currentOverrides = JSON.parse(settings.catalog_url_overrides || "{}");

      // Adicionar novo override
      currentOverrides[productName] = { atacadoSlug };

      // Salvar de volta
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.apiSecret}` },
        body: JSON.stringify({ catalog_url_overrides: JSON.stringify(currentOverrides) }),
      });

      setLinkingStatus((s) => ({ ...s, [productName]: "Vinculado! Rode o scrape para atualizar." }));
    } catch {
      setLinkingStatus((s) => ({ ...s, [productName]: "Erro ao salvar" }));
    }
  }, [linkingUrl]);

  const customCount = Object.keys(overrides).length;
  const ex = 50 * (1 + globalSettings.margin / 100);
  const exParc = ex * (1 + globalSettings.cardRate / 100);
  const exPix = exParc * (1 - globalSettings.pixDiscount / 100);
  const exMensal = globalSettings.installments > 0 ? exParc / globalSettings.installments : 0;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const tz = "America/Sao_Paulo";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: tz })
      + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  };

  return (
    <div className="space-y-6">
      {/* Scrape status */}
      {scrapeStale ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-700">Dados desatualizados</p>
            <p className="text-xs text-red-600 mt-0.5">
              {updatedAt
                ? `Ultimo scrape: ${formatDate(updatedAt)} (${Math.floor(hoursAgo)}h atras)`
                : "Nenhum scrape registrado"}
            </p>
            <p className="text-[11px] text-red-500 mt-1">
              Rode <code className="bg-red-100 px-1 rounded">npm run scrape:all</code> no seu computador
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs text-emerald-700">
            Dados atualizados{updatedAt ? ` em ${formatDate(updatedAt)}` : ""}
            <span className="text-emerald-500 ml-1">({dataSource === "turso" ? "banco" : "local"})</span>
          </p>
        </div>
      )}

      {/* Catalog alerts: novos produtos / removidos */}
      {showCatalogAlerts && (catalogAlerts.newProducts.length > 0 || catalogAlerts.missing.length > 0) && (
        <div className="space-y-3">
          {catalogAlerts.newProducts.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-blue-700">{catalogAlerts.newProducts.length} produto(s) novo(s) no fornecedor</p>
                    <p className="text-[11px] text-blue-500 mt-0.5">Clique para adicionar ao seu catalogo.</p>
                    <div className="mt-2 space-y-1">
                      {catalogAlerts.newProducts.slice(0, 15).map((np) => (
                        <div key={np.slug} className="flex items-center gap-2 bg-blue-100/50 rounded-lg px-2 py-1">
                          {np.img && <img src={np.img} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-blue-800 truncate">{np.name}</p>
                            <p className="text-[9px] text-blue-500">{np.category} · R${np.cost}</p>
                          </div>
                          <button
                            onClick={() => handleAddProduct(np)}
                            disabled={addingProduct === np.name}
                            className="text-[10px] font-bold px-2 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex-shrink-0"
                          >
                            {addingProduct === np.name ? "..." : "Adicionar"}
                          </button>
                        </div>
                      ))}
                      {catalogAlerts.newProducts.length > 15 && (
                        <p className="text-[10px] text-blue-400">+{catalogAlerts.newProducts.length - 15} mais</p>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowCatalogAlerts(false)} className="text-blue-300 hover:text-blue-500 text-lg leading-none">&times;</button>
              </div>
            </div>
          )}

          {catalogAlerts.missing.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-amber-700">{catalogAlerts.missing.length} produto(s) nao encontrado(s) no fornecedor</p>
                    <p className="text-[11px] text-amber-500 mt-0.5">Cole a URL do atacado para vincular.</p>
                    <div className="mt-2 space-y-2">
                      {catalogAlerts.missing.slice(0, 10).map((name) => (
                        <div key={name} className="bg-amber-100/50 rounded-lg px-2.5 py-2">
                          <p className="text-[11px] font-semibold text-amber-800">{name}</p>
                          {linkingStatus[name] ? (
                            <p className="text-[10px] text-amber-600 mt-1">{linkingStatus[name]}</p>
                          ) : (
                            <div className="flex gap-1 mt-1">
                              <input
                                type="text"
                                placeholder="https://www.floraamaratacado.com.br/slug-at/"
                                value={linkingUrl[name] || ""}
                                onChange={(e) => setLinkingUrl((s) => ({ ...s, [name]: e.target.value }))}
                                className="flex-1 text-[11px] px-2 py-1 border border-amber-300 rounded-lg bg-white min-w-0"
                              />
                              <button
                                onClick={() => handleLinkUrl(name)}
                                disabled={!linkingUrl[name]?.trim()}
                                className="text-[10px] font-bold px-2 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 flex-shrink-0"
                              >
                                Vincular
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowCatalogAlerts(false)} className="text-amber-300 hover:text-amber-500 text-lg leading-none">&times;</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="bg-gradient-to-br from-brand-400 to-brand-500 text-white rounded-xl p-5">
        <h3 className="font-bold text-sm uppercase tracking-wider mb-3 opacity-80">
          Resumo de Margem
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs opacity-70">Produtos</p>
            <p className="text-xl font-black">{available.length}</p>
          </div>
          <div>
            <p className="text-xs opacity-70">Com margem individual</p>
            <p className="text-xl font-black">{customCount}</p>
          </div>
          <div>
            <p className="text-xs opacity-70">Custo total (c/ frete)</p>
            <p className="text-lg font-bold">{formatBRL(totalCost)}</p>
          </div>
          <div>
            <p className="text-xs opacity-70">Venda total (cartao)</p>
            <p className="text-lg font-bold">{formatBRL(totalSell)}</p>
          </div>
        </div>
        <div className="border-t border-white/20 pt-3 mt-3 flex justify-between items-center">
          <span className="font-semibold">Lucro liquido total:</span>
          <span className="font-black text-2xl">{formatBRL(totalProfit)}</span>
        </div>
      </div>

      {/* Quick example */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">
          Simulacao Rapida (custo R$ 50)
        </h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-[10px] text-brand-400 uppercase">{globalSettings.installments}x sem juros</p>
            <p className="font-bold text-brand-500">{formatBRL(exMensal)}/mes</p>
            <p className="text-[9px] text-gray-400 mt-0.5">total {formatBRL(exParc)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-[10px] text-emerald-500 uppercase">PIX (-{globalSettings.pixDiscount}%)</p>
            <p className="font-bold text-emerald-600">{formatBRL(exPix)}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <ExportButton />
        <button
          onClick={() => window.print()}
          className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-sm"
        >
          Imprimir / PDF
        </button>
      </div>
    </div>
  );
}
