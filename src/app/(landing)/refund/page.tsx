import React from 'react';

export const metadata = {
  title: 'Refund Policy',
  description: 'Understand the Framebooks refund policy for monthly and annual subscription plans.',
};

export default function RefundPolicyPage() {
  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24 bg-white text-[#082830]">
      <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
        {/* Title */}
        <div className="border-b border-[#E5E7EB] pb-6 mb-10">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#082830] mb-3">
            Refund Policy<span className="text-[#00E35B]">.</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium">
            Effective Date: November 2026 • Product of Frametoque Digital Productions
          </p>
        </div>

        {/* Body Content */}
        <div className="prose prose-sm sm:prose-base max-w-none text-gray-600 space-y-8 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">1. Overview</h2>
            <p>
              At Framebooks, operated by Frametoque Digital Productions, we strive to provide transparent, fair, and reliable financial tools for Sri Lankan businesses. We want you to be completely confident in the value our platform brings to your business.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">2. Free Tier &amp; Evaluation</h2>
            <p>
              We offer a lifetime Free plan that allows businesses to explore invoicing, quotation generation, multi-account banking, and standard financial reporting at zero cost. We encourage all prospective customers to evaluate the Free plan to ensure Framebooks meets their business requirements prior to upgrading.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">3. Subscription Plans &amp; Refunds</h2>
            
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
                <h3 className="text-sm font-bold text-[#082830] mb-1">A. Monthly Subscriptions</h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  Monthly subscription payments are billed in advance on a recurring monthly cycle. You may cancel your subscription at any time. When cancelled, your plan remains active until the end of your current monthly billing period with no further charges. If you experience an unresolved technical issue preventing platform access within 7 days of an initial monthly payment, you may request a full review for a refund.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
                <h3 className="text-sm font-bold text-[#082830] mb-1">B. Annual Subscriptions (14-Day Money-Back Guarantee)</h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  Annual subscriptions receive a substantial discount (2 months free). If you are unsatisfied with your annual subscription for any reason, you may request a full refund within <strong>14 days of purchase or renewal</strong>. After 14 days, annual plans are non-refundable, but cancellation ensures your plan will not renew for the following year.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
                <h3 className="text-sm font-bold text-[#082830] mb-1">C. Specialized Add-Ons (Cloud POS &amp; Stock)</h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  Recurring add-ons (such as POS counter terminals at LKR 3,000/mo) follow the monthly subscription terms. You can enable or disable add-ons at any time via <strong>Settings &gt; Billing</strong>.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">4. How Refunds Are Processed</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>All refunds are issued in Sri Lankan Rupees (LKR) to the original credit/debit card used for the transaction via our payment gateway partner, Payments.lk.</li>
              <li>Once approved, refunds typically reflect in your bank account statement within <strong>5 to 10 business days</strong>, depending on your card issuer (e.g. Commercial Bank, Sampath Bank, HNB, BOC).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#082830]">5. How to Request a Refund</h2>
            <p>
              To request a refund or dispute a charge, please email our billing team with your account details:
            </p>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs sm:text-sm space-y-1">
              <p className="font-bold text-[#082830]">Frametoque Digital Productions - Billing Department</p>
              <p>Email: <a href="mailto:framebooks@frametoque.com" className="text-[#00C750] font-semibold hover:underline">framebooks@frametoque.com</a></p>
              <p className="text-gray-500 text-xs mt-1">Please include: Your registered business name, account email, payment reference ID, and reason for the request.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
