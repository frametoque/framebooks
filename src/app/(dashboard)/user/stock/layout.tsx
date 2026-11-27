import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stock",
  description: "Stock catalog, barcode label printing, inventory adjustments, and WooCommerce catalog sync.",
};

export default function StockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
