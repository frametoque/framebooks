import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Invoice | Framebooks",
};

export default function EditInvoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
