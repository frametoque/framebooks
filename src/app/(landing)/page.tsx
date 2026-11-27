import { Metadata } from 'next';
import LandingClient from '@/components/landing/LandingClient';
import { getLandingPlansFormatted } from '@/lib/plans-db';
import { getPosAddonPricing } from '@/lib/pos/entitlement';

export const metadata: Metadata = {
  title: 'Framebooks - Modern Cloud ERP & Accounting for Sri Lanka',
  description: 'Run your whole business finances in one place. Invoices, quotations, expenses, bank accounts, clients, inventory and reports for Sri Lankan businesses.',
  openGraph: {
    title: 'Framebooks - Modern Cloud ERP',
    description: 'Run your whole business finances in one place.',
    type: 'website',
  }
};

export const revalidate = 3600; // 1-hour ISR cache: served instantly from CDN without running serverless lambda

export default async function LandingPage() {
  const [dynamicPlans, posPricing] = await Promise.all([
    getLandingPlansFormatted(),
    getPosAddonPricing(),
  ]);

  return <LandingClient initialPlans={dynamicPlans} initialPosPricing={posPricing} />;
}
