import React from 'react';

export const metadata = {
  title: 'Privacy Policy - Framebooks',
  description: 'Learn how Framebooks protects your business, financial, and personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24 bg-white text-[#082830]">
      <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
        {/* Title */}
        <div className="border-b border-[#E5E7EB] pb-6 mb-10">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#082830] mb-3">
            Privacy Policy<span className="text-[#00E35B]">.</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium">
            Effective Date: November 2026 • Product of Frametoque Digital Productions
          </p>
        </div>

        {/* Body Content */}
        <div className="prose prose-sm sm:prose-base max-w-none text-gray-600 space-y-8 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">1. Introduction & Scope</h2>
            <p>
              Framebooks (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), operated by Frametoque Digital Productions, provides an all-in-one cloud financial operating system, bookkeeping platform, and Point of Sale (POS) system designed for businesses in Sri Lanka.
            </p>
            <p>
              This Privacy Policy explains how we collect, store, process, and protect your personal and business financial data when you visit our website, register for an account, or use any Framebooks application or service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">2. Information We Collect</h2>
            <p>We collect information to provide secure and compliant financial management tools:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Account Credentials:</strong> Name, email address, passwordless WebAuthn biometric passkey tokens, phone number, and Google OAuth profile data.</li>
              <li><strong>Business Information:</strong> Company name, business registration (BR / PV) number, contact address, tax identification numbers, and brand logos.</li>
              <li><strong>Financial & Transactional Records:</strong> Invoices, quotations, client directory information, income logs, expense receipts, bank account names, and account numbers.</li>
              <li><strong>Retail & Stock Data:</strong> Product SKUs, bar codes, stock counts, counter sales orders, register shifts, and cashier activity logs.</li>
              <li><strong>Technical Metadata:</strong> IP addresses, browser user agent, device operating system, and system security audit trails.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">3. How We Protect Your Data</h2>
            <p>Security is the foundation of Framebooks. We implement rigorous safeguards to protect sensitive business records:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Bank-Grade Encryption:</strong> All sensitive financial fields (account numbers, client details) are protected with authenticated AES-256 encryption at rest and TLS 1.3 in transit.</li>
              <li><strong>Multi-Tenant Isolation:</strong> Your business records reside in isolated tenant containers with cryptographic row verification to prevent unauthorized cross-tenant data access.</li>
              <li><strong>Biometric Passkeys:</strong> Support for modern FIDO2/WebAuthn standards (Touch ID, Face ID, Windows Hello) eliminates phishing risks associated with traditional passwords.</li>
              <li><strong>System Audit Trails:</strong> Every critical record modification, invoice generation, and security configuration is permanently recorded in an immutable audit log.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">4. How We Use Your Information</h2>
            <p>We use your information exclusively to provide and improve the Framebooks service:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Generating branded PDF invoices, quotations, and official receipts.</li>
              <li>Computing real-time Profit &amp; Loss, Cash Flow, and Balance Sheet statements in LKR.</li>
              <li>Processing register sales, cash drawer reconciliations, and physical stock synchronization.</li>
              <li>Providing customer support, system alerts, and optional daily financial reminders.</li>
            </ul>
            <p className="font-semibold text-gray-800">
              We never sell, rent, monetize, or trade your financial data, customer lists, or transaction history with any third parties or advertisers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">5. Third-Party Service Providers</h2>
            <p>We work with trusted infrastructure and payment partners solely to deliver the service:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Payment Processing:</strong> Online card transactions and subscription billing are processed securely through Payments.lk, adhering to strict PCI-DSS standards. We never store full credit or debit card numbers on our servers.</li>
              <li><strong>Cloud Hosting &amp; Backups:</strong> Cloud infrastructure with enterprise-grade physical data center security and automated daily backups.</li>
              <li><strong>Store Integrations:</strong> If you connect WooCommerce, data exchange occurs strictly over encrypted HTTPS webhooks configured by your administrator.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">6. Data Ownership &amp; Export</h2>
            <p>
              You own your data at all times. You can export your full accounting history, invoices, expenses, and client records to standard CSV files at any time via <strong>Settings &gt; Data Export</strong>.
            </p>
            <p>
              If you decide to close your account, you can permanently delete your workspace and all associated financial records through the Danger Zone in your settings.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">7. Contact &amp; Privacy Inquiries</h2>
            <p>
              If you have any questions about this Privacy Policy or wish to exercise your data protection rights, please contact our privacy compliance team:
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
