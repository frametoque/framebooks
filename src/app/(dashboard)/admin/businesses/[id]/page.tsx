// src/app/(dashboard)/admin/businesses/[id]/page.tsx
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BusinessDetailView } from "@/app/(dashboard)/admin/_components/BusinessDetailView";
import { getBusinessDetails } from "@/app/(dashboard)/admin/users/actions";

export const dynamic = "force-dynamic";

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = parseInt(id, 10);
  if (isNaN(tenantId)) notFound();

  const businessData = await getBusinessDetails(tenantId);
  if (!businessData) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/subscriptions" className="hover:text-foreground flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Subscriptions & Businesses
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{businessData.tenant.name}</span>
      </div>

      <BusinessDetailView businessData={businessData} />
    </div>
  );
}
