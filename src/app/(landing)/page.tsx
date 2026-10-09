import { Metadata } from 'next';
import LandingClient from '@/components/landing/LandingClient';
import { getLandingPlansFormatted } from '@/lib/plans-db';

export const metadata: Metadata = {
  title: 'Framebooks - Modern Cloud ERP & Accounting for Sri Lanka',
  description: 'Run your whole business finances in one place. Invoices, quotations, expenses, bank accounts, clients, inventory and reports for Sri Lankan businesses.',
  openGraph: {
    title: 'Framebooks - Modern Cloud ERP',
    description: 'Run your whole business finances in one place.',
    type: 'website',
  }
};

export default async function LandingPage() {
  const dynamicPlans = await getLandingPlansFormatted();
  return <LandingClient initialPlans={dynamicPlans} />;
}
