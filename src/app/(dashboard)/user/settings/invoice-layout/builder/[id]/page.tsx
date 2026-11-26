import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTenantPlan } from "@/app/(dashboard)/user/actions/plan";
import { getInvoiceLayout, canCustomizeInvoices } from "@/app/(dashboard)/user/actions/invoice-layouts";
import BuilderClient from "./BuilderClient";

export const metadata: Metadata = {
  title: "Invoice Layout | Framebooks",
};

export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getTenantPlan();

  if (plan !== "Pro Plus") {
    redirect("/settings/invoice-layout");
  }

  const allowed = await canCustomizeInvoices();
  if (!allowed) {
    redirect("/settings/invoice-layout");
  }

  let layoutData = null;
  if (id !== "new") {
    layoutData = await getInvoiceLayout(id);
    if (!layoutData) {
      redirect("/settings/invoice-layout");
    }
  }

  return <BuilderClient layoutId={id} initialLayout={layoutData} />;
}
