// src/app/(dashboard)/admin/payments/[id]/page.tsx
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PaymentDetailClient } from "./PaymentDetailClient";
import { getPaymentDetail } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const paymentId = parseInt(id, 10);
  if (isNaN(paymentId)) notFound();

  const data = await getPaymentDetail(paymentId);
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/payments" className="hover:text-foreground flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Payments
        </Link>
        <span>/</span>
        <span className="text-foreground font-mono font-medium">
          {data.payment.provider_reference || `PAY-${data.payment.id}`}
        </span>
      </div>

      <PaymentDetailClient data={data} />
    </div>
  );
}
