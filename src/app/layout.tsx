import Providers from "@/components/Providers";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import type { Metadata, Viewport } from 'next'
import { DM_Mono } from "next/font/google";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";

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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning
        className={`${dmMono.variable} font-sans antialiased tracking-tight`}
      >
        <Providers>
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
