import React from 'react';

export const metadata = {
  title: 'Terms of Service - Framebooks',
  description: 'Terms and conditions for using the Framebooks accounting, ERP, and Point of Sale platform.',
};

export default function TermsOfServicePage() {
  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24 bg-white text-[#082830]">
      <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
        {/* Title */}
        <div className="border-b border-[#E5E7EB] pb-6 mb-10">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#082830] mb-3">
            Terms of Service<span className="text-[#00E35B]">.</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium">
            Effective Date: November 2026 • Product of Frametoque Digital Productions
          </p>
        </div>

        {/* Body Content */}
        <div className="prose prose-sm sm:prose-base max-w-none text-gray-600 space-y-8 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">1. Acceptance of Terms</h2>
            <p>
              By creating an account, accessing, or using Framebooks (the &quot;Service&quot;), provided by Frametoque Digital Productions (&quot;Frametoque&quot;, &quot;we&quot;, or &quot;us&quot;), you agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a company or other legal entity, you represent that you have the authority to bind such entity to these terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">2. Description of the Service</h2>
            <p>
              Framebooks is a cloud-based financial operating system that includes accounting ledgers, invoicing, quotations, expense tracking, multi-account banking reconciliation, real-time financial reporting, stock management, and retail Point of Sale (POS) tools, configured natively in Sri Lankan Rupees (LKR).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">3. Account Registration &amp; Security</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You must provide accurate, current, and complete information during registration.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials, passkeys, and manager authorization PINs.</li>
              <li>You are solely responsible for all activities that occur under your workspace by authorized users, cashiers, and accountants.</li>
              <li>You must notify us immediately upon becoming aware of any unauthorized access or breach of security.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">4. Subscription Plans, Billing &amp; Renewals</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Free Plan:</strong> Includes basic invoicing, client management, and banking tracking subject to feature and lifetime volume limits.</li>
              <li><strong>Paid Subscriptions (Pro &amp; Pro Plus):</strong> Billed on a recurring monthly or annual basis in Sri Lankan Rupees (LKR). Annual subscriptions provide 2 months free compared to monthly billing.</li>
              <li><strong>Add-Ons:</strong> Specialized modules such as Cloud POS &amp; Stock are billed as recurring add-ons alongside your base subscription.</li>
              <li><strong>Payment Processing:</strong> Card payments are securely settled through Payments.lk. By providing payment information, you authorize us to charge applicable subscription fees.</li>
              <li><strong>Upgrades &amp; Downgrades:</strong> You may change or cancel your subscription plan at any time through your workspace billing settings.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">5. Acceptable Use Policy</h2>
            <p>You agree not to misuse the Service. You shall not:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Use the Service for any fraudulent, illegal, or unauthorized business activities.</li>
              <li>Attempt to probe, scan, or breach the security, authentication, or isolation boundaries of the platform.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service or servers.</li>
              <li>Reverse engineer, decompile, or copy any portion of the software, UI design, or source code.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">6. Intellectual Property &amp; User Content</h2>
            <p>
              <strong>Your Data:</strong> You retain full ownership and intellectual property rights in all financial data, invoices, client records, and transaction histories uploaded or created by you.
            </p>
            <p>
              <strong>Our Platform:</strong> Frametoque Digital Productions retains all right, title, and interest in and to the Framebooks platform, branding, trademarks, algorithms, code, and documentation.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">7. Disclaimers &amp; Limitation of Liability</h2>
            <p>
              Framebooks is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. While we strive for 99.9% uptime and mathematical accuracy, Framebooks is a productivity and accounting software tool, not a certified public accounting firm or licensed tax legal advisor. Users are responsible for verifying the accuracy of tax filings and financial statements.
            </p>
            <p>
              To the maximum extent permitted by applicable law, Frametoque Digital Productions shall not be liable for any indirect, incidental, special, or consequential damages resulting from the use or inability to use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">8. Governing Law &amp; Jurisdiction</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the Democratic Socialist Republic of Sri Lanka, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">9. Contact Information</h2>
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
