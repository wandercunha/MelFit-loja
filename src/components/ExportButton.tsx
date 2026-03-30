"use client";

import { useCatalog } from "@/context/CatalogContext";
import { PRODUCTS } from "@/data/products";
import { calcProduct, formatBRL, getColorFromName, getInitials } from "@/lib/pricing";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/types";

export function ExportButton() {
  const { globalSettings, overrides } = useCatalog();

  const handleExport = () => {
    const products = PRODUCTS.filter((p) => !p.soldOut);

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
        const calc = calcProduct(p, globalSettings, overrides[p.id]);
        const color = getColorFromName(p.name);
        cards += `
          <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
            <div style="width:100%;aspect-ratio:3/4;background:linear-gradient(135deg,${color}15,${color}30);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
              ${p.img ? `<img src="${p.img}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;" alt="${p.name}" loading="lazy">` : `<span style="color:${color};opacity:0.2;font-size:2.5em;font-weight:900;">${getInitials(p.name)}</span>`}
              ${p.tags.includes("novidade") ? '<span style="position:absolute;top:10px;right:10px;background:#16a34a;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px;">NOVO</span>' : ""}
            </div>
            <div style="padding:14px;">
              <div style="font-size:10px;color:#b8860b;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${CATEGORY_LABELS[p.category] || p.category}</div>
              <div style="font-weight:600;margin:4px 0 6px;font-size:14px;color:#1f2937;">${p.name}</div>
              <div style="font-size:12px;color:#9ca3af;">Tam: ${p.sizes}</div>
              <div style="font-size:20px;font-weight:800;color:#8b6914;margin-top:8px;">${formatBRL(calc.sellPrice)}</div>
            </div>
          </div>`;
      });

      sections += `
        <div style="margin-bottom:40px;">
          <h2 style="font-size:1.3em;font-weight:700;color:#8b6914;margin:0 0 16px;padding-bottom:8px;border-bottom:3px solid #daa520;display:flex;align-items:center;gap:10px;">
            ${CATEGORY_LABELS[cat] || cat}
            <span style="background:#daa520;color:#fff;font-size:11px;padding:2px 10px;border-radius:99px;">${items.length}</span>
          </h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px;">
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
header{background:linear-gradient(135deg,#1a1a1a,#2d2d2d);color:#fff;padding:28px 30px;text-align:center;}
header h1{font-size:2.2em;font-weight:900;letter-spacing:3px;}
header h1 span{font-weight:300;}
header p{color:rgba(255,255,255,0.5);margin-top:6px;font-size:0.9em;}
.container{max-width:1400px;margin:0 auto;padding:24px 30px 60px;}
footer{background:#1a1a1a;color:rgba(255,255,255,0.4);text-align:center;padding:24px;font-size:0.85em;}
@media(max-width:768px){.container{padding:12px;}}
@media print{body{background:#fff;}header{padding:15px;}}
</style>
</head>
<body>
<header>
<h1><span style="color:#daa520;">Mel</span><span>Fit</span></h1>
<p>Catálogo de Moda Fitness | Preços atualizados</p>
</header>
<div class="container">
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
