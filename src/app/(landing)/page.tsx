import { Metadata } from 'next';
import LandingClient from '@/components/landing/LandingClient';
import { getLandingPlansFormatted } from '@/lib/plans-db';
import { getPosAddonPricing } from '@/lib/pos/entitlement';

export const metadata: Metadata = {
  title: 'Framebooks - Modern Cloud ERP, Accounting & Retail POS System',
  description: 'The all-in-one business platform for Sri Lanka. Lightning-fast retail POS counter, automated inventory, invoices, quotations, bank accounts, and financial accounting.',
  keywords: [
    'Cloud ERP Sri Lanka',
    'POS System Sri Lanka',
    'Point of Sale',
    'Retail POS Counter',
    'Barcode Scanner POS',
    'Cash Register Software',
    'Invoicing Software Sri Lanka',
    'Inventory & Stock Management',
    'Accounting Software Sri Lanka',
    'WooCommerce POS Sync'
  ],
  openGraph: {
    title: 'Framebooks - Modern Cloud ERP, Accounting & Retail POS',
    description: 'Run your whole business finances and checkout counters in one place. Lightning-fast POS, invoicing, stock tracking, and accounting.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Framebooks - Modern Cloud ERP & Retail POS',
    description: 'All-in-one business platform: Retail POS registers, barcode stock management, invoicing, and finances.',
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
