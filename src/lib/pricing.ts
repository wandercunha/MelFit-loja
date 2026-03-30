import { Product, ProductOverride, GlobalSettings, PriceCalc } from "./types";

export function calcProduct(
  product: Product,
  global: GlobalSettings,
  override?: ProductOverride
): PriceCalc {
  const margin = override?.margin ?? global.margin;
  const shipping = override?.shipping ?? global.shipping;
  const cardRate = global.cardRate;
  const pixDiscount = global.pixDiscount;
  const installments = global.installments;

  const cost = product.cost;
  const totalCost = cost + shipping;

  // Preço cartão à vista = custo * (1 + margem%) → preço REAL
  const priceCard = cost * (1 + margin / 100);

  // PIX = preço cartão - desconto%
  const pricePix = priceCard * (1 - pixDiscount / 100);

  // Parcelado = preço cartão + taxa do cartão%
  const priceInstallment = priceCard * (1 + cardRate / 100);

  // Parcela mensal
  const installmentMonthly = installments > 0 ? priceInstallment / installments : priceInstallment;

  // Lucro líquido baseado no cartão à vista (cenário mais conservador, sem taxa)
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
