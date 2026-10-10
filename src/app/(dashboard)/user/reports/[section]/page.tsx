import React, { Suspense } from "react";
import ReportsClient from "../ReportsClient";
import { Loader } from "@/components/ui/Loader";

export const dynamic = "force-dynamic";

const SLUG_TO_REPORT_TAB: Record<string, string> = {
  "overview": "overview",
  "profit-loss": "profit_loss",
  "profit_loss": "profit_loss",
  "cash-flow": "cash_flow",
  "cash_flow": "cash_flow",
  "balance-sheet": "balance_sheet",
  "balance_sheet": "balance_sheet",
  "tax-summary": "tax_summary",
  "tax_summary": "tax_summary",
  "trial-balance": "trial_balance",
  "trial_balance": "trial_balance",
  "general-ledger": "general_ledger",
  "general_ledger": "general_ledger",
  "account-ledger": "account_ledger",
  "account_ledger": "account_ledger",
};

const SECTION_METADATA: Record<string, { title: string; description: string }> = {
  "overview": { title: "Financial Overview - Reports", description: "Financial overview and key performance metrics." },
  "profit-loss": { title: "Profit & Loss - Reports", description: "Profit and Loss statement and revenue breakdown." },
  "profit_loss": { title: "Profit & Loss - Reports", description: "Profit and Loss statement and revenue breakdown." },
  "cash-flow": { title: "Cash Flow - Reports", description: "Statement of cash flows from operating, investing, and financing." },
  "cash_flow": { title: "Cash Flow - Reports", description: "Statement of cash flows from operating, investing, and financing." },
  "balance-sheet": { title: "Balance Sheet - Reports", description: "Balance sheet statement of assets, liabilities, and equity." },
  "balance_sheet": { title: "Balance Sheet - Reports", description: "Balance sheet statement of assets, liabilities, and equity." },
  "tax-summary": { title: "Tax Summary - Reports", description: "Tax summary and liabilities overview." },
  "tax_summary": { title: "Tax Summary - Reports", description: "Tax summary and liabilities overview." },
  "trial-balance": { title: "Trial Balance - Reports", description: "Trial balance ledger report with debit and credit balances." },
  "trial_balance": { title: "Trial Balance - Reports", description: "Trial balance ledger report with debit and credit balances." },
  "general-ledger": { title: "General Ledger - Reports", description: "Complete record of all financial transactions." },
  "general_ledger": { title: "General Ledger - Reports", description: "Complete record of all financial transactions." },
  "account-ledger": { title: "Account Ledger - Reports", description: "Account-level transaction ledger and running balances." },
  "account_ledger": { title: "Account Ledger - Reports", description: "Account-level transaction ledger and running balances." },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }> | { section: string };
}) {
  const resolvedParams = await params;
  const section = resolvedParams?.section || "";
  const meta = SECTION_METADATA[section];
  if (!meta) return { title: "Reports" };
  return {
    title: meta.title,
    description: meta.description,
  };
}

export default async function ReportSectionPage({
  params,
}: {
  params: Promise<{ section: string }> | { section: string };
}) {
  const resolvedParams = await params;
  const section = resolvedParams?.section || "";
  const tab = (SLUG_TO_REPORT_TAB[section] || "overview") as any;

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader /></div>}>
      <ReportsClient initialTab={tab} />
    </Suspense>
  );
}
