import React from 'react';

export const metadata = {
  title: 'Cookie Policy - Framebooks',
  description: 'Understand how Framebooks uses cookies and local browser storage to keep your session secure.',
};

export default function CookiePolicyPage() {
  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24 bg-white text-[#082830]">
      <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
        {/* Title */}
        <div className="border-b border-[#E5E7EB] pb-6 mb-10">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#082830] mb-3">
            Cookie Policy<span className="text-[#00E35B]">.</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium">
            Effective Date: November 2026 • Product of Frametoque Digital Productions
          </p>
        </div>

        {/* Body Content */}
        <div className="prose prose-sm sm:prose-base max-w-none text-gray-600 space-y-8 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">1. What Are Cookies?</h2>
            <p>
              Cookies are small text files and browser storage items placed on your computer or mobile device when you browse websites. They are widely used to make websites work properly, provide secure user authentication, and remember your interface preferences.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">2. How Framebooks Uses Cookies</h2>
            <p>
              Framebooks uses minimal, privacy-respecting cookies and client storage keys strictly necessary to deliver the financial dashboard and Point of Sale functions:
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
                <h3 className="text-sm font-bold text-[#082830] mb-1">A. Strictly Necessary &amp; Security Cookies</h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-2">
                  Essential for logging into your account, maintaining authenticated sessions, verifying CSRF tokens, and executing biometric passkey handshakes.
                </p>
                <ul className="text-xs text-gray-500 list-disc pl-4 space-y-1">
                  <li><code>__Secure-next-auth.session-token</code>: Maintains your secure encrypted login session.</li>
                  <li><code>fb_csrf_token</code>: Protects against cross-site request forgery attacks.</li>
                  <li><code>tenant_id</code>: Ensures requests route to your isolated business workspace.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
                <h3 className="text-sm font-bold text-[#082830] mb-1">B. Functional &amp; Preference Storage</h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-2">
                  Remembers your interface custom settings so you do not have to reconfigure them on every visit.
                </p>
                <ul className="text-xs text-gray-500 list-disc pl-4 space-y-1">
                  <li><code>fb_theme</code>: Remembers light or dark dashboard mode preference.</li>
                  <li><code>fb_privacy_blur</code>: Remembers your public workspace privacy blur toggle.</li>
                  <li><code>fb_cookies</code>: Remembers whether you have acknowledged the cookie banner.</li>
                  <li><code>pos_terminal_settings</code>: Caches your preferred receipt printer width and audio feedback state on counter hardware.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">3. We Do Not Use Third-Party Tracking Cookies</h2>
            <p>
              Unlike many web services, Framebooks <strong>does not use third-party advertising trackers</strong>, cross-site behavioral tracking cookies, or data broker beacons. Your bookkeeping and financial activity is never monitored for targeted marketing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">4. Managing Your Cookie Preferences</h2>
            <p>
              You can control and manage your cookie preferences at any time:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>On-Site Cookie Banner:</strong> When you first visit Framebooks, our cookie notification allows you to choose &quot;Only necessary&quot; or &quot;Accept all&quot;.</li>
              <li><strong>Browser Settings:</strong> You can configure your browser (Chrome, Safari, Firefox, Edge) to reject or delete cookies. Please note that disabling strictly necessary cookies will prevent you from logging into your workspace.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">5. Questions &amp; Inquiries</h2>
            <p>
              For questions regarding our use of cookies and data storage practices, please contact:
            </p>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs sm:text-sm">
              <p className="font-bold text-[#082830]">Frametoque Digital Productions</p>
              <p>Email: <a href="mailto:framebooks@frametoque.com" className="text-[#00C750] font-semibold hover:underline">framebooks@frametoque.com</a></p>
              <p>Web: <a href="https://frametoque.com" target="_blank" rel="noopener noreferrer" className="text-[#00C750] font-semibold hover:underline">frametoque.com</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
