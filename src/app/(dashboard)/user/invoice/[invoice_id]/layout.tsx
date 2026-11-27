import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ invoice_id: string }>;
}): Promise<Metadata> {
  const { invoice_id } = await params;
  return {
    title: invoice_id ? `Invoice #${invoice_id}` : "Invoice Details",
  };
}

export default function InvoiceViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
