export interface Product {
  id: number;
  name: string;
  cost: number;
  category: string;
  tags: Tag[];
  sizes: string;
  img: string;
  slug?: string;
  soldOut?: boolean;
  description?: string;  // HTML — descricao do produto
  isCustom?: boolean;    // true = adicionado via admin (salvo no Turso)
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
  fakeDiscount?: number;  // % "desconto" visual (preço real não muda)
}

export interface CategoryOverride {
  margin?: number;
  shipping?: number;
}

export interface GlobalSettings {
  margin: number;
  shipping: number;
  cardRate: number;       // taxa total do cartão parcelado (ex: 13.99%)
  pixDiscount: number;    // desconto PIX (ex: 4%)
  installments: number;   // número de parcelas (ex: 6)
  // WhatsApp config
  whatsappNumber: string;
  whatsappGreeting: string;
  // Login atacado (para scraping)
  atacadoEmail: string;
  atacadoPassword: string;
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

// ─── Carrinho ───

export interface CartItem {
  productId: number;
  name: string;
  size: string;              // avulsa: "M", conjunto: "Top P + Short G"
  quantity: number;
  img: string;
  category: string;
  pieceSizes?: { name: string; size: string }[];  // conjuntos: tamanho por peça
}

export interface CartCustomer {
  name: string;
  phone: string;
  email: string;
}

export type PaymentMethod = "pix" | "credito_vista" | "credito_parcelado" | "debito";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  credito_vista: "Cartão de Crédito à Vista",
  credito_parcelado: "Cartão de Crédito Parcelado",
  debito: "Cartão de Débito",
};

export const CATEGORY_ORDER: Category[] = [
  "conjuntos",
  "tops",
  "shorts",
  "leggings",
  "macaquinhos",
  "macacoes",
];
