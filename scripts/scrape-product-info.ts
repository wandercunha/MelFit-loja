/**
 * Scrape de detalhes dos produtos do ATACADO (descricao, composicao, medidas)
 * Busca na pagina individual de cada produto e extrai informacoes tecnicas.
 * Remove qualquer mencao ao fabricante/marca.
 *
 * Roda via: npx tsx scripts/scrape-product-info.ts
 */

import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const BASE_URL = "https://www.floraamaratacado.com.br";
const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY || "5000", 10);

// Termos do fabricante para remover
const BRAND_TERMS = [
  /flora\s*amar/gi,
  /floraamar/gi,
  /flora\s*amar\s*atacado/gi,
  /As peças no site de atacado são destinadas à revenda e não possuem a logo da Flora Amar\./gi,
  /As pe[cç]as.*logo.*Flora.*Amar\.?/gi,
  /logo\s*(da\s*)?flora\s*amar/gi,
];

function removeBrand(text: string): string {
  let clean = text;
  for (const re of BRAND_TERMS) {
    clean = clean.replace(re, "").trim();
  }
  // Remove linhas vazias extras
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();
  return clean;
}

interface ProductInfo {
  name: string;
  slug: string;
  description: string;
  modelInfo: string;
  composition: string;
  technology: string;
  compression: string;
  hasBraPad: string;
  reference: string;
  sizeChart: string;
  specs: Record<string, string>;
}

let sessionCookies = "";

function fetchHTML(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
        Referer: BASE_URL + "/",
        Cookie: sessionCookies,
      },
    }, (res) => {
      // Capturar cookies
      const newCookies = res.headers["set-cookie"] || [];
      if (newCookies.length > 0) {
        const existing = new Map(sessionCookies.split("; ").filter(Boolean).map(c => {
          const [k] = c.split("=");
          return [k, c] as [string, string];
        }));
        newCookies.forEach(c => {
          const pair = c.split(";")[0];
          const [k] = pair.split("=");
          existing.set(k, pair);
        });
        sessionCookies = Array.from(existing.values()).join("; ");
      }

      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redir = res.headers.location.startsWith("http") ? res.headers.location : `${BASE_URL}${res.headers.location}`;
        fetchHTML(redir).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    }).on("error", reject).setTimeout(15000, () => reject(new Error("Timeout")));
  });
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function scrapeProductInfo(html: string, slug: string): ProductInfo | null {
  if (html.length < 2000) return null; // pagina de erro

  const $ = cheerio.load(html);

  const name = $("h1").first().text().trim() || $("title").text().split("-")[0].trim();

  // Descricao: geralmente na div.descricao ou .product-description
  let description = "";
  const descSelectors = [".descricao", ".product-description", "#descricao", "[itemprop='description']"];
  for (const sel of descSelectors) {
    const el = $(sel);
    if (el.length > 0) {
      description = el.text().trim();
      break;
    }
  }

  // Se nao achou, tenta pegar do bloco de texto principal apos a galeria
  if (!description) {
    $(".informacoes p, .detalhes p, .texto p").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 50 && !description) description = text;
    });
  }

  // Specs: tabela de especificacoes
  const specs: Record<string, string> = {};
  let composition = "";
  let technology = "";
  let compression = "";
  let hasBraPad = "";
  let reference = "";
  let modelInfo = "";

  // Busca em tabelas de especificacao
  $("table tr, .especificacoes tr, .ficha-tecnica tr").each((_, tr) => {
    const cells = $(tr).find("td, th");
    if (cells.length >= 2) {
      const key = $(cells[0]).text().trim().toUpperCase().replace(":", "");
      const val = $(cells[1]).text().trim();
      if (key && val) {
        specs[key] = val;
        if (key.includes("COMPOSI")) composition = val;
        if (key.includes("TECNOLOG")) technology = val;
        if (key.includes("COMPRESS")) compression = val;
        if (key.includes("BOJO") || key.includes("ENTRADA")) hasBraPad = val;
        if (key.includes("REFER")) reference = val;
      }
    }
  });

  // Buscar specs em formato <dt>/<dd> ou label/value
  $("dl dt, .spec-label, .titulo-detalhe").each((_, el) => {
    const key = $(el).text().trim().toUpperCase().replace(":", "");
    const val = $(el).next("dd, .spec-value, .descricao-detalhe").text().trim();
    if (key && val) {
      specs[key] = val;
      if (key.includes("COMPOSI")) composition = val;
      if (key.includes("TECNOLOG")) technology = val;
      if (key.includes("COMPRESS")) compression = val;
      if (key.includes("BOJO") || key.includes("ENTRADA")) hasBraPad = val;
      if (key.includes("REFER")) reference = val;
    }
  });

  // Buscar specs em formato inline (key: value em sequencia)
  const fullText = $(".descricao, .informacoes, .detalhes, .produto-info").text();
  const specPatterns = [
    { key: "composition", re: /COMPOSI[ÇC][ÃA]O:\s*([^\n]+)/i },
    { key: "technology", re: /TECNOLOGIA:\s*([^\n]+)/i },
    { key: "compression", re: /COMPRESS[ÃA]O:\s*([^\n]+)/i },
    { key: "hasBraPad", re: /ENTRADA\s*BOJO:\s*([^\n]+)/i },
    { key: "reference", re: /REFER[ÊE]NCIA:\s*([^\n]+)/i },
  ];

  for (const { key, re } of specPatterns) {
    const m = fullText.match(re);
    if (m) {
      const val = m[1].trim();
      if (key === "composition" && !composition) composition = val;
      if (key === "technology" && !technology) technology = val;
      if (key === "compression" && !compression) compression = val;
      if (key === "hasBraPad" && !hasBraPad) hasBraPad = val;
      if (key === "reference" && !reference) reference = val;
    }
  }

  // Modelo veste
  const modelMatch = fullText.match(/Modelo veste[:\s]*([^\n]+(?:\n[^\n]*(?:Medidas|Cintura|Quadril|Busto|Altura|Peso)[^\n]*)*)/i);
  if (modelMatch) {
    modelInfo = modelMatch[0].trim();
  }

  // Tabela de medidas: imagem com "template" ou "duvida" ou "medida" no folder do produto
  let sizeChart = "";
  const ATACADO_CDN = "97065044c3a1a212e5c7a4f183fed028";
  $("img").each((_, el) => {
    const src = $(el).attr("data-src") || $(el).attr("src") || "";
    if (src.includes(ATACADO_CDN) && src.includes("/produtos/") &&
        (src.includes("template") || src.includes("medida") || src.includes("tabela") || src.includes("duvida"))) {
      if (!sizeChart) sizeChart = src.startsWith("http") ? src : `https://${src}`;
    }
  });

  // Limpar mencoes ao fabricante
  description = removeBrand(description);
  modelInfo = removeBrand(modelInfo);

  return {
    name,
    slug,
    description,
    modelInfo,
    composition,
    technology,
    compression,
    hasBraPad,
    reference,
    sizeChart,
    specs,
  };
}

async function main() {
  const startTime = Date.now();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  SCRAPE ATACADO — SPECS TÉCNICAS`);
  console.log(`  Fonte: ${BASE_URL} (ATACADO)`);
  console.log(`  Capturando: composicao, tecnologia, compressao, medidas`);
  console.log(`  Data: ${new Date().toISOString()}`);
  console.log(`  Delay: ${SCRAPE_DELAY}ms`);
  console.log(`${"=".repeat(60)}\n`);

  // Carregar produtos do atacado-details para ter os slugs
  const dataDir = path.join(__dirname, "..", "src", "data");
  const atacadoDetails = JSON.parse(fs.readFileSync(path.join(dataDir, "atacado-details.json"), "utf-8"));
  const atacadoProducts = atacadoDetails.products as Record<string, { name: string; atacadoSlug: string }>;

  const results: Record<string, ProductInfo> = {};
  const slugs = Object.entries(atacadoProducts);
  let success = 0;
  let errors = 0;

  // Iniciar sessao
  console.log("  Iniciando sessao...");
  try {
    await fetchHTML(BASE_URL + "/");
    console.log("  Sessao OK\n");
  } catch {
    console.log("  Sem sessao (continuando...)\n");
  }

  for (let i = 0; i < slugs.length; i++) {
    const [_baseSlug, { name, atacadoSlug }] = slugs[i];
    process.stdout.write(`  [${i + 1}/${slugs.length}] ${atacadoSlug}...`);

    try {
      const html = await fetchHTML(`${BASE_URL}/${atacadoSlug}/`);
      const info = scrapeProductInfo(html, atacadoSlug);

      if (info && (info.description || info.composition)) {
        results[atacadoSlug] = info;
        success++;
        const parts = [
          info.description ? "desc" : "",
          info.composition ? "comp" : "",
          info.technology ? "tech" : "",
          info.modelInfo ? "modelo" : "",
          info.sizeChart ? "tabela" : "",
        ].filter(Boolean).join(", ");
        console.log(` OK (${parts})`);
      } else {
        console.log(" sem detalhes");
      }
    } catch (err: any) {
      errors++;
      console.log(` ERRO: ${err.message}`);
    }

    await delay(SCRAPE_DELAY);
  }

  // Salvar
  const outputPath = path.join(dataDir, "product-info.json");
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    source: BASE_URL,
    count: Object.keys(results).length,
    products: results,
  }, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  RESUMO`);
  console.log(`  Tempo: ${elapsed}s | Produtos: ${success} | Erros: ${errors}`);
  console.log(`  Salvo em: product-info.json`);
  console.log(`${"─".repeat(60)}\n`);
}

main().catch(console.error);
