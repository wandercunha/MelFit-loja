import { Product, ProductOverride, GlobalSettings, PriceCalc, CategoryOverride } from "./types";

export function calcProduct(
  product: Product,
  global: GlobalSettings,
  override?: ProductOverride,
  categoryOverride?: CategoryOverride
): PriceCalc {
  // Cascata: individual > categoria > global
  const margin = override?.margin ?? categoryOverride?.margin ?? global.margin;
  const shipping = override?.shipping ?? categoryOverride?.shipping ?? global.shipping;
  const cardRate = global.cardRate;
  const pixDiscount = global.pixDiscount;
  const installments = global.installments;

  const cost = product.cost;
  const totalCost = cost + shipping;

  // Preço base (custo + margem) — sem taxa do cartão
  const priceCard = cost * (1 + margin / 100);

  // Preço final com taxa embutida — este é o preço de venda real
  // (cartão 1x ou 6x, mesmo total; taxa repassada ao cliente)
  const priceInstallment = priceCard * (1 + cardRate / 100);

  // PIX = preço com taxa − desconto PIX%
  // (o cliente que paga no pix economiza o desconto sobre o valor com taxa)
  const pricePix = priceInstallment * (1 - pixDiscount / 100);

  // Parcela mensal (total com taxa / nº parcelas)
  const installmentMonthly = installments > 0 ? priceInstallment / installments : priceInstallment;

  // Lucro líquido: receita líquida do cartão (priceCard) menos custo total
  const netProfit = priceCard - totalCost;
  const netMargin = priceCard > 0 ? (netProfit / priceCard) * 100 : 0;

  return {
    cost,
    shipping,
    totalCost,
    priceCard,
    pricePix,
    priceInstallment,
    installmentMonthly,
    installments,
    netProfit,
    netMargin,
    appliedMargin: margin,
    cardRate,
    pixDiscount,
  };
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── URLs do fornecedor (geradas a partir de dados dinâmicos do Turso) ──
export function toSlug(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+c\/\s*/g, "-c-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function buildAtacadoUrl(product: { name: string; slug?: string; category: string }, atacadoByName?: Record<string, any>): string {
  const atacado = atacadoByName?.[product.name];
  if (atacado?.atacadoSlug) return `https://www.floraamaratacado.com.br/${atacado.atacadoSlug}/`;
  const fallback = product.slug || toSlug(product.name);
  const suffix = product.category === "conjuntos" ? "" : "-at";
  return `https://www.floraamaratacado.com.br/${fallback}${suffix}/`;
}

export function buildVarejoUrl(product: { name: string; slug?: string }): string {
  const slug = product.slug || toSlug(product.name);
  return `https://www.floraamar.com.br/${slug}/`;
}

const COLOR_MAP: Record<string, string> = {
  preto: "#2d2d2d",
  cinza: "#9e9e9e",
  branco: "#f5f5f5",
  "off white": "#faf5ef",
  "azul marinho": "#1a237e",
  "azul sky": "#42a5f5",
  "azul elegance": "#3949ab",
  "azul petroleo": "#006064",
  azul: "#1565c0",
  "verde militar": "#4a5c3c",
  "verde herb": "#558b2f",
  verde: "#2e7d32",
  vermelho: "#c62828",
  cereja: "#ad1457",
  amora: "#6a1b9a",
  "rosa soft": "#f48fb1",
  rosa: "#e91e63",
  "amarelo energy": "#fdd835",
  amarelo: "#f9a825",
  marrom: "#5d4037",
  coffee: "#6d4c41",
  cappuccino: "#a1887f",
  cafe: "#6d4c41",
  terracota: "#bf5b3c",
  lilas: "#ab47bc",
  blush: "#f8bbd0",
  off: "#faf5ef",
};

export function getColorFromName(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return color;
  }
  return "#d4a574";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 2)
    .map((w) => w[0])
    .join("")
    .substring(0, 3)
    .toUpperCase();
}
