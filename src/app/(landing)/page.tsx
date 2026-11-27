import { Metadata } from 'next';
import LandingClient from '@/components/landing/LandingClient';
import { getLandingPlansFormatted } from '@/lib/plans-db';
import { getPosAddonPricing } from '@/lib/pos/entitlement';

export const metadata: Metadata = {
  title: 'Framebooks — Business finances and Point of Sale, unified',
  description: 'The all-in-one platform for Sri Lankan business. Lightning-fast retail POS, live inventory, invoices, bank ledgers, and financial intelligence.',
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
    title: 'Framebooks — Business finances and Point of Sale, unified',
    description: 'Invoices, cash registers, real-time stock, and bank ledgers. Beautifully engineered to work together as one.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Framebooks — Business finances and Point of Sale, unified',
    description: 'Invoices, cash registers, real-time stock, and bank ledgers. Beautifully engineered to work together as one.',
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
