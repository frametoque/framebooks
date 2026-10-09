// src/app/(dashboard)/admin/users/[id]/page.tsx
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { UserDetailClient } from "./UserDetailClient";
import { getUserDetails } from "../actions";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) notFound();

  const data = await getUserDetails(userId);
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/subscriptions" className="hover:text-foreground flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Subscriptions
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{data.user.email}</span>
      </div>

      <UserDetailClient data={data} />
    </div>
  );
}
