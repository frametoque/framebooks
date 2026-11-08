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
  title: {
    default: "Framebooks",
    template: "%s"
  },
  description: "Run your entire business in one place. Track money, manage clients, and grow faster.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Framebooks",
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
                if (c && /^#[0-9a-fA-F]{6}$/i.test(c)) {
                  document.documentElement.style.setProperty('--accent', c);
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
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
