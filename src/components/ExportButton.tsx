"use client";

import { useCatalog } from "@/context/CatalogContext";
import { useCatalogData } from "@/context/CatalogDataContext";
import { calcProduct, formatBRL, getColorFromName, getInitials } from "@/lib/pricing";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/types";

export function ExportButton() {
  const { globalSettings, overrides, categoryOverrides, isProductVisible } = useCatalog();
  const { allProducts } = useCatalogData();

  const handleExport = () => {
    const products = allProducts.filter((p) => isProductVisible(p.id, p.soldOut));

    const groups: Record<string, typeof products> = {};
    CATEGORY_ORDER.forEach((cat) => {
      groups[cat] = products.filter((p) => p.category === cat);
    });

    let sections = "";
    CATEGORY_ORDER.forEach((cat) => {
      const items = groups[cat];
      if (!items || items.length === 0) return;

      let cards = "";
      items.forEach((p) => {
        const calc = calcProduct(p, globalSettings, overrides[p.id], categoryOverrides[p.category]);
        const color = getColorFromName(p.name);
        cards += `
          <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 15px rgba(0,0,0,0.07);">
            <div style="width:100%;aspect-ratio:3/4;background:linear-gradient(135deg,${color}15,${color}30);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
              ${p.img ? `<img src="${p.img}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;" alt="${p.name}" loading="lazy">` : `<span style="color:${color};opacity:0.2;font-size:2.5em;font-weight:900;">${getInitials(p.name)}</span>`}
              ${p.tags.includes("novidade") ? '<span style="position:absolute;top:10px;right:10px;background:#16a34a;color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:99px;">NOVO</span>' : ""}
            </div>
            <div style="padding:16px;">
              <div style="font-size:10px;color:#b8860b;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">${CATEGORY_LABELS[p.category] || p.category}</div>
              <div style="font-weight:600;margin-bottom:6px;font-size:14px;color:#1f2937;line-height:1.3;">${p.name}</div>
              <div style="font-size:11px;color:#9ca3af;margin-bottom:10px;">Tam: ${p.sizes}</div>
              <div style="background:#ecfdf5;border-radius:8px;padding:8px 10px;margin-bottom:8px;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-size:10px;font-weight:700;color:#047857;background:#a7f3d0;padding:2px 6px;border-radius:4px;">PIX</span>
                  <span style="font-size:20px;font-weight:800;color:#047857;">${formatBRL(calc.pricePix)}</span>
                </div>
                <div style="font-size:10px;color:#059669;margin-top:2px;">${calc.pixDiscount}% de desconto</div>
              </div>
              <div style="font-size:12px;color:#4b5563;margin-bottom:2px;">Cartão: <strong>${formatBRL(calc.priceCard)}</strong></div>
              <div style="font-size:12px;color:#92400e;">Parcelado: <strong>${calc.installments}x de ${formatBRL(calc.installmentMonthly)}</strong></div>
            </div>
          </div>`;
      });

      sections += `
        <div style="margin-bottom:40px;">
          <h2 style="font-size:1.3em;font-weight:700;color:#8b6914;margin:0 0 16px;padding-bottom:10px;border-bottom:3px solid #daa520;display:flex;align-items:center;gap:10px;">
            ${CATEGORY_LABELS[cat] || cat}
            <span style="background:#daa520;color:#fff;font-size:11px;padding:3px 12px;border-radius:99px;font-weight:700;">${items.length}</span>
          </h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;">
            ${cards}
          </div>
        </div>`;
    });

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>MelFit - Catálogo Moda Fitness</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#faf8f5;color:#1f2937;line-height:1.6;}
header{background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);color:#fff;padding:30px;text-align:center;}
header h1{font-size:2.4em;font-weight:900;letter-spacing:4px;}
header p{color:rgba(255,255,255,0.5);margin-top:8px;font-size:0.9em;}
.container{max-width:1400px;margin:0 auto;padding:30px 30px 60px;}
.whatsapp-bar{background:#25d366;padding:14px 30px;text-align:center;}
.whatsapp-bar a{color:#fff;text-decoration:none;font-weight:700;font-size:1em;display:inline-flex;align-items:center;gap:8px;}
.payment-info{background:#fff;border:2px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:30px;text-align:center;}
.payment-info h3{color:#1f2937;font-size:1.1em;margin-bottom:10px;}
.payment-info p{color:#6b7280;font-size:0.9em;line-height:1.6;}
footer{background:#1a1a1a;color:rgba(255,255,255,0.4);text-align:center;padding:24px;font-size:0.85em;}
@media(max-width:768px){.container{padding:15px;}}
</style>
</head>
<body>
<header>
<h1><span style="color:#daa520;">Mel</span><span style="font-weight:300;">Fit</span></h1>
<p>Catálogo de Moda Fitness | Preços atualizados</p>
</header>
<div class="whatsapp-bar">
<a href="https://wa.me/?text=Oi!%20Vi%20seu%20catalogo%20MelFit%20e%20gostaria%20de%20saber%20mais!" target="_blank">
<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
Fale comigo no WhatsApp
</a>
</div>
<div class="container">
<div class="payment-info">
<h3>Formas de Pagamento</h3>
<p><strong style="color:#047857;">PIX:</strong> ${globalSettings.pixDiscount}% de desconto | <strong>Cartão à vista</strong> | <strong style="color:#92400e;">Parcelado em até ${globalSettings.installments}x</strong> no cartão de crédito</p>
</div>
${sections}
</div>
<footer>
<p>Catálogo MelFit - Moda Fitness</p>
<p style="margin-top:4px;">Consulte disponibilidade e tamanhos</p>
</footer>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalogo-melfit.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button onClick={handleExport} className="btn-success w-full py-3">
      Exportar Catálogo (HTML)
    </button>
  );
}
