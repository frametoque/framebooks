import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Income | Framebooks",
};

export default function IncomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
