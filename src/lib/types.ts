export interface Product {
  id: number;
  name: string;
  cost: number;
  category: Category;
  tags: Tag[];
  sizes: string;
  img: string;
  slug?: string;
  soldOut?: boolean;
}

export type Category =
  | "tops"
  | "shorts"
  | "leggings"
  | "macaquinhos"
  | "macacoes"
  | "conjuntos";

export type Tag = "novidade" | "colecao-exclusiva";

export interface ProductOverride {
  margin?: number;
  shipping?: number;
}

export interface GlobalSettings {
  margin: number;
  shipping: number;
  cardRate: number;       // taxa total do cartão parcelado (ex: 13.99%)
  pixDiscount: number;    // desconto PIX (ex: 4%)
  installments: number;   // número de parcelas (ex: 6)
}

export interface PriceCalc {
  cost: number;
  shipping: number;
  totalCost: number;
  // Preço cartão à vista = preço real (custo + margem)
  priceCard: number;
  // PIX = preço cartão - desconto
  pricePix: number;
  // Parcelado = preço cartão + taxa
  priceInstallment: number;
  // Valor da parcela mensal
  installmentMonthly: number;
  // Número de parcelas
  installments: number;
  // Lucro líquido (baseado no preço cartão à vista)
  netProfit: number;
  // Margem líquida
  netMargin: number;
  // Margem aplicada
  appliedMargin: number;
  // Taxa do cartão aplicada
  cardRate: number;
  // Desconto PIX aplicado
  pixDiscount: number;
}

export const CATEGORY_LABELS: Record<string, string> = {
  tops: "Tops & Regatas",
  shorts: "Shorts",
  leggings: "Leggings",
  macaquinhos: "Macaquinhos",
  macacoes: "Macacões",
  conjuntos: "Conjuntos",
  novidade: "Novidades",
  "colecao-exclusiva": "Coleção Exclusiva",
};

export const CATEGORY_ORDER: Category[] = [
  "conjuntos",
  "tops",
  "shorts",
  "leggings",
  "macaquinhos",
  "macacoes",
];
