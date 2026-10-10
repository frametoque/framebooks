// src/app/(dashboard)/user/settings/invoice-layout/builder/[id]/page.tsx
import { redirect } from "next/navigation";
import { getTenantPlan } from "@/app/(dashboard)/user/actions/plan";
import { getInvoiceLayout } from "@/app/(dashboard)/user/actions/invoice-layouts";
import BuilderClient from "./BuilderClient";

export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getTenantPlan();

  if (plan !== "Pro Plus") {
    redirect("/user/settings?tab=invoice_layout");
  }

  let layoutData = null;
  if (id !== "new") {
    layoutData = await getInvoiceLayout(id);
    if (!layoutData) {
      redirect("/user/settings?tab=invoice_layout");
    }
  }

  return <BuilderClient layoutId={id} initialLayout={layoutData} />;
}
