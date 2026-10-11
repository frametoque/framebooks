import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Quotation | Framebooks",
};

export default function NewQuotationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
