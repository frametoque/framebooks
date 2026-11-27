import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Quotation",
};

export default function EditQuotationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
