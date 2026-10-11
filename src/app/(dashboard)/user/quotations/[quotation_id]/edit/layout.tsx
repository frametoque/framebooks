import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Quotation | Framebooks",
};

export default function EditQuotationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
