import type { Metadata } from "next";
import "./globals.css";
import { CatalogProvider } from "@/context/CatalogContext";

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
        <CatalogProvider>{children}</CatalogProvider>
      </body>
    </html>
  );
}
