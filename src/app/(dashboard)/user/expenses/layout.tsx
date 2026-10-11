import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Expenses | Framebooks",
};

export default function ExpensesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
