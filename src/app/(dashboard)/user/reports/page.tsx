import React, { Suspense } from "react";
import ReportsClient from "./ReportsClient";
import { Loader } from "@/components/ui/Loader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reports",
  description: "Comprehensive financial overview, profit & loss, balance sheet, and accounting ledgers.",
};

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader /></div>}>
      <ReportsClient initialTab="overview" />
    </Suspense>
  );
}
