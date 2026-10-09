// src/app/(dashboard)/admin/users/page.tsx
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const queryString = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null) as [string, string][]
  ).toString();

  redirect(`/admin/subscriptions${queryString ? `?${queryString}` : ""}`);
}
