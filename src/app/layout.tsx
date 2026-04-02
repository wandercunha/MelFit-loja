import type { Metadata } from "next";
import "./globals.css";
import { CatalogProvider } from "@/context/CatalogContext";
import { CatalogDataProvider } from "@/context/CatalogDataContext";
import { CartProvider } from "@/context/CartContext";

export const metadata: Metadata = {
  title: "MelFit - Catálogo Moda Fitness",
  description: "Catálogo de roupas fitness - MelFit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <CatalogDataProvider>
          <CatalogProvider>
            <CartProvider>{children}</CartProvider>
          </CatalogProvider>
        </CatalogDataProvider>
      </body>
    </html>
  );
}
