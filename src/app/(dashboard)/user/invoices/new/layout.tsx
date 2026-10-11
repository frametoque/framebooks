import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Invoice | Framebooks",
};

export default function NewInvoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
