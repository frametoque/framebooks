import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CheckCircle2, Shield } from "lucide-react";

export const metadata = {
  title: "FrameBookss | All-in-One Business Management SaaS",
  description: "Run your entire business in one place. Track money, manage clients, and grow faster — no spreadsheets needed.",
};

const features = [
  { title: "Income & Expenses", desc: "Track cash flow automatically." },
  { title: "Smart Invoicing", desc: "Send professional invoices in seconds." },
  { title: "Inventory Management", desc: "Keep track of stock levels in real-time." },
  { title: "Client CRM", desc: "Manage your client relationships effortlessly." },
  { title: "Bank-Grade Security", desc: "Your data is encrypted and secure." },
];

const plans = [
  {
    name: "Free",
    price: "0",
    features: ["100 Invoices/Income/Expenses", "50 Clients", "2 Accounts"],
    cta: "Get Started",
    href: "/login",
  },
  {
    name: "Pro",
    price: "2,500",
    features: ["Unlimited Invoices", "Unlimited Clients", "2 Accounts"],
    cta: "Start Free Trial",
    href: "/login",
  },
  {
    name: "Pro Plus",
    price: "5,000",
    features: ["Unlimited Accounts", "Inventory Management", "Advanced Analytics"],
    cta: "Start Free Trial",
    href: "/login",
  },
  {
    name: "Ultra",
    price: "Custom",
    features: ["Custom Infrastructure", "Dedicated Support", "SLA"],
    cta: "Contact Sales",
    href: "/contact",
  },
];

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-foreground">
      {/* Navbar */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto border-b border-border">
        <div className="text-xl font-bold text-foreground tracking-tighter">FrameBookss.</div>
        <div className="flex gap-4">
          {session?.user ? (
            <Link href="/user/dashboard" className="bg-blue-600 text-foreground px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">Dashboard</Link>
          ) : (
            <Link href="/login" className="bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors">Get Started</Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="px-6 py-24 text-center max-w-4xl mx-auto animate-in slide-in-from-bottom duration-700">
        <div className="inline-flex items-center gap-2 bg-transparent border border-border rounded-full px-4 py-1.5 text-sm text-[#5FC8F8] mb-8">
          <Shield className="w-4 h-4" /> Built with Bank-Grade Security
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
          All-in-One Business <br/> Management SaaS
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Run your entire business in one place. Track money, manage clients, and grow faster — no spreadsheets needed.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/login" className="bg-[#169FE4] hover:bg-[#0288D1] text-foreground px-8 py-4 rounded-xl font-bold text-lg transition-colors">
            Start for Free
          </Link>
        </div>
      </main>

      {/* Features */}
      <section className="py-24 bg-transparent border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16">Everything you need to succeed</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="p-6 rounded-2xl bg-[#0a0a0f] border border-border">
                <CheckCircle2 className="w-8 h-8 text-[#169FE4] mb-4" />
                <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                <p className="text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-16">Simple, transparent pricing</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {plans.map((p, i) => (
            <div key={i} className="p-8 rounded-2xl bg-transparent border border-border flex flex-col hover:border-[#169FE4]/50 transition-colors">
              <h3 className="text-2xl font-bold mb-2">{p.name}</h3>
              <div className="text-3xl font-black mb-6">
                {p.price !== "Custom" ? <span className="text-xl text-gray-400 font-medium">LKR </span> : null}
                {p.price}
                {p.price !== "Custom" ? <span className="text-base text-gray-400 font-medium">/mo</span> : null}
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-3 text-gray-300">
                    <CheckCircle2 className="w-5 h-5 text-[#169FE4]" /> {f}
                  </li>
                ))}
              </ul>
              <Link href={p.href} className="block text-center w-full bg-white/10 hover:bg-white/20 text-foreground py-3 rounded-xl font-medium transition-colors">
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
