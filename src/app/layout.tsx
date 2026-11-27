import Providers from "@/components/Providers";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import type { Metadata, Viewport } from 'next'
import { DM_Mono } from "next/font/google";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import PwaThemeSync from "@/components/pwa/PwaThemeSync";

const dmMono = DM_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#00E35B',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://books.frametoque.com'),
  title: {
    default: "Framebooks | Cloud ERP, Accounting & Retail POS",
    template: "%s | Framebooks"
  },
  description: "Modern Cloud ERP, Business Accounting & Retail POS for growing businesses. Run your entire business in one place: invoices, quotations, live counter registers, barcode stock management, and financial ledgers.",
  keywords: [
    "Framebooks",
    "Cloud ERP",
    "POS System Sri Lanka",
    "Retail Point of Sale",
    "Barcode POS",
    "Cash Register Software",
    "Accounting Software",
    "Invoicing Software",
    "Inventory & Stock Management",
    "WooCommerce POS Sync",
    "Sri Lanka Business Software"
  ],
  authors: [{ name: "Frametoque" }],
  creator: "Frametoque",
  publisher: "Framebooks",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Framebooks POS & ERP",
  },
  openGraph: {
    title: "Framebooks | Cloud ERP, Accounting & Retail POS",
    description: "The complete cloud ERP, accounting, and retail POS platform. Run your business finances and retail checkout counters seamlessly.",
    siteName: "Framebooks",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Framebooks | Cloud ERP, Accounting & Retail POS",
    description: "Modern all-in-one platform for Cloud ERP, bookkeeping, and lightning-fast retail POS counter checkout.",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="tenant-accent-early-init"
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                if (window.location.pathname.indexOf('/user') === -1) return;
                var m = document.cookie.match(/(?:^|;\\s*)fb_accent_color=([^;]+)/);
                var c = m ? decodeURIComponent(m[1]) : (typeof localStorage !== 'undefined' ? localStorage.getItem('framebooks_accent_color') : null);
                if (c) {
                  var hero = null;
                  if (c.indexOf('gta6') !== -1) hero = '#C9349B';
                  else if (c.indexOf('f1') !== -1) hero = '#8C3041';
                  else if (c.indexOf('cricket') !== -1) hero = '#0A50A1';
                  else if (c.indexOf('flag') !== -1) hero = '#8D153A';
                  else if (c.indexOf('xmas') !== -1 || c.indexOf('christmas') !== -1 || c.indexOf('chirtmas') !== -1) hero = '#A60311';
                  else if (/^#[0-9a-fA-F]{6}$/i.test(c)) hero = c;
                  if (hero) document.documentElement.style.setProperty('--accent', hero);
                }
                if (typeof localStorage !== 'undefined' && localStorage.getItem('framebooks_privacy_mode') === 'true') {
                  document.documentElement.classList.add('privacy-mode');
                }
              } catch(e){}
            })();`,
          }}
        />
      </head>
      <body suppressHydrationWarning
        className={`${dmMono.variable} font-sans antialiased tracking-tight`}
      >
        <Providers>
          <PwaThemeSync />
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
          {(process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV) && <Analytics />}
        </Providers>
      </body>
    </html>
  );
}
