import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bank Accounts | Framebooks",
};

export default function AccountsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
