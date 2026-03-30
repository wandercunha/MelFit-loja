export interface Product {
  id: number;
  name: string;
  cost: number;
  category: Category;
  tags: Tag[];
  sizes: string;
  img: string;
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
  installment?: number;
}

export interface GlobalSettings {
  margin: number;
  shipping: number;
  installment: number;
}

export interface PriceCalc {
  cost: number;
  totalCost: number;
  sellPrice: number;
  shipping: number;
  installmentFee: number;
  netProfit: number;
  netMargin: number;
  appliedMargin: number;
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
