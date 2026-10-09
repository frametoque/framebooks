"use client";

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { MdCheck, MdTrendingUp, MdAccountBalance, MdCallMade, MdCallReceived, MdInsertDriveFile, MdGroup, MdInventory, MdSecurity, MdGroups, MdPerson, MdArrowForward } from 'react-icons/md';
import { kpis, features, modulesData, workflowSteps, securityFeatures, plans, comparison, faqs } from '@/data/landing/content';
import PlanFinderWidget from '@/components/landing/PlanFinderWidget';

export default function LandingClient({ initialPlans }: { initialPlans?: any[] }) {
  const [yearly, setYearly] = useState(false);
  const [openFaqs, setOpenFaqs] = useState<number[]>([]);

  const toggleFaq = (index: number) => {
    setOpenFaqs((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const displayPlans = initialPlans && initialPlans.length > 0 ? initialPlans : plans;

  const getIcon = (name: string) => {
    switch (name) {
      case 'MdCallReceived': return <MdCallReceived className="w-6 h-6" />;
      case 'MdCallMade': return <MdCallMade className="w-6 h-6" />;
      case 'MdAccountBalance': return <MdAccountBalance className="w-6 h-6" />;
      case 'MdInsertDriveFile': return <MdInsertDriveFile className="w-6 h-6" />;
      case 'MdGroup': return <MdGroup className="w-6 h-6" />;
      case 'MdInventory': return <MdInventory className="w-6 h-6" />;
      case 'MdTrendingUp': return <MdTrendingUp className="w-6 h-6" />;
      case 'MdAutorenew': return <MdTrendingUp className="w-6 h-6" />; // fallback
      case 'MdAccountBalanceWallet': return <MdAccountBalance className="w-6 h-6" />; // fallback
      default: return <MdCheck className="w-6 h-6" />;
    }
  };

  return (
    <div className="w-full">
      <main>
        {/* HERO */}
        <section className="pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden px-6">
          <div className="container mx-auto max-w-5xl text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="inline-block px-4 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm mb-6 text-sm font-semibold text-gray-600">
              Built for Sri Lanka 🇱🇰
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-6">
              Run your whole business finances in one place<span className="text-[#00E35B]">.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              Invoices, quotations, expenses, bank accounts, clients, inventory and reports, all in one seamless dashboard built for modern teams.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
              <Link href="/login" className="w-full sm:w-auto px-8 py-4 bg-[#00E35B] hover:bg-[#00C750] text-[#041418] font-bold rounded-full transition-transform hover:scale-105 shadow-md text-lg">Start Free</Link>
              <a href="#features" className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-gray-50 border border-gray-200 text-[#082830] font-bold rounded-full transition-colors text-lg">See how it works</a>
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-sm text-gray-500 font-medium">
              End-to-end encryption • No credit card needed • Multi-account support
            </motion.p>

            {/* Mockup visual */}
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.8 }} className="mt-20 relative mx-auto max-w-4xl">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#26F29C] to-blue-400 rounded-[2rem] blur opacity-20"></div>
              <div className="relative bg-white border border-[#E5E7EB] rounded-[2rem] shadow-2xl p-6 md:p-8 aspect-[16/9] flex flex-col overflow-hidden">
                {/* Header mock */}
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black text-[#082830]">Framebooks</span>
                    <span className="w-px h-5 bg-gray-200"></span>
                    <span className="text-lg font-bold text-[#082830]">Dashboard</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-gray-500 hidden sm:block">Thu, Oct 8, 2026</span>
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-[#082830]">
                      <MdPerson className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                {/* Body mock */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Available Funds', value: '7.145M LKR', icon: <MdAccountBalance /> },
                    { label: 'Total Income', value: '6.055M LKR', icon: <MdCallReceived /> },
                    { label: 'Total Expenses', value: '984.7K LKR', icon: <MdCallMade /> },
                    { label: 'Net Profit', value: '5.07M LKR', icon: <MdTrendingUp /> }
                  ].map((stat, i) => (
                    <div key={i} className="bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] p-4 flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-[#00C750] shadow-sm">
                          {stat.icon}
                        </div>
                        <span className="text-xs font-semibold text-gray-500">{stat.label}</span>
                      </div>
                      <div className="text-lg font-black text-[#041418]">{stat.value}</div>
                    </div>
                  ))}
                </div>
                <div className="flex-1 flex gap-4">
                  <div className="flex-[2] bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] p-5 flex flex-col">
                    <div className="text-sm font-bold text-[#082830] mb-6">Income vs Expenses</div>
                    <div className="flex items-end gap-3 h-full mt-auto pb-2">
                      {[40, 70, 30, 80, 50, 90].map((h, i) => (
                        <div key={i} className="flex-1 flex gap-1 justify-center items-end h-full relative group">
                          <div className="w-full max-w-[12px] bg-[#00E35B] rounded-t-sm" style={{ height: `${h}%` }}></div>
                          <div className="w-full max-w-[12px] bg-red-400 rounded-t-sm" style={{ height: `${h * 0.4}%` }}></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] p-5 flex flex-col items-center justify-center relative">
                    <div className="absolute top-5 left-5 text-sm font-bold text-[#082830]">Expense Breakdown</div>
                    <div className="w-24 h-24 sm:w-32 sm:h-32 mt-6 rounded-full border-[12px] border-[#00E35B] border-r-gray-200 border-b-[#082830] shadow-sm"></div>
                  </div>
                </div>
              </div>

              {/* Floating chips */}
              <div className="absolute top-1/4 -left-12 bg-white px-4 py-3 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-3 animate-bounce" style={{ animationDuration: '3s' }}>
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><MdCheck /></div>
                <div><p className="text-xs text-gray-500 font-semibold">Invoice #1042</p><p className="font-bold text-sm">Paid in full</p></div>
              </div>
              <div className="absolute bottom-1/4 -right-8 bg-[#00E35B] px-4 py-3 rounded-2xl shadow-xl border border-[#26F29C] flex items-center gap-3 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
                <div className="w-8 h-8 rounded-full bg-white/20 text-[#041418] flex items-center justify-center"><MdTrendingUp /></div>
                <div><p className="text-xs text-[#082830] font-bold opacity-80">Net Profit</p><p className="font-bold text-sm text-[#041418]">+124.5%</p></div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FEATURES (Previously Modules) */}
        <section id="features" className="py-24 bg-[#F9FAFB]">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black mb-4">Everything your finances need.<br />Nothing they don't<span className="text-[#00E35B]">.</span></h2>
              <p className="text-gray-600 max-w-2xl mx-auto mt-4">Everything you need to manage your business, neatly organized into powerful features.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {modulesData.map((mod) => {
                let Icon = MdCheck;
                if (mod.id === 'dashboard') Icon = MdTrendingUp;
                if (mod.id === 'invoices') Icon = MdInsertDriveFile;
                if (mod.id === 'quotations') Icon = MdInsertDriveFile;
                if (mod.id === 'income-expenses') Icon = MdCallReceived;
                if (mod.id === 'accounts') Icon = MdAccountBalance;
                if (mod.id === 'clients') Icon = MdGroup;
                if (mod.id === 'inventory') Icon = MdInventory;
                if (mod.id === 'team') Icon = MdGroups;
                if (mod.id === 'security') Icon = MdSecurity;

                return (
                  <div key={mod.id} className="bg-white rounded-3xl p-8 border border-[#E5E7EB] shadow-sm hover:shadow-lg transition-shadow group">
                    <div className="w-14 h-14 bg-[#F9FAFB] rounded-2xl flex items-center justify-center mb-6 text-[#00C750] group-hover:scale-110 group-hover:bg-[#E6FDF0] transition-all">
                      <Icon className="w-7 h-7" />
                    </div>
                    <h3 className="text-2xl font-black mb-6">{mod.title}</h3>
                    <ul className="space-y-4">
                      {mod.benefits.map((b, j) => (
                        <li key={j} className="flex items-start gap-3 text-sm text-gray-600">
                          <div className="mt-0.5 shrink-0 text-[#00E35B]"><MdCheck /></div>
                          <span className="leading-relaxed">{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="py-24 bg-[#F9FAFB]">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black mb-4">Start free. Upgrade when you grow<span className="text-[#00E35B]">.</span></h2>
              <div className="flex items-center justify-center gap-4 mt-8">
                <span className={`font-semibold ${!yearly ? 'text-[#082830]' : 'text-gray-500'}`}>Monthly</span>
                <button onClick={() => setYearly(!yearly)} className="w-14 h-8 bg-[#082830] rounded-full p-1 relative transition-colors">
                  <div className={`w-6 h-6 bg-[#26F29C] rounded-full transition-transform ${yearly ? 'translate-x-6' : ''}`} />
                </button>
                <span className={`font-semibold ${yearly ? 'text-[#082830]' : 'text-gray-500'}`}>Yearly <span className="text-xs text-[#007A31] bg-[#E6FDF0] px-2 py-0.5 rounded-full ml-1">Save 20%</span></span>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${displayPlans.length === 1 ? 'max-w-md' :
                displayPlans.length === 2 ? 'max-w-3xl md:grid-cols-2' :
                  displayPlans.length === 4 ? 'max-w-7xl sm:grid-cols-2 lg:grid-cols-4' :
                    'max-w-5xl md:grid-cols-3'
              } gap-8 items-start mx-auto mb-12`}>
              {displayPlans.map((p, i) => (
                <div key={i} className={`bg-white rounded-3xl p-8 border ${p.highlight ? 'border-[#00E35B] ring-2 ring-[#00E35B]/20' : 'border-[#E5E7EB]'} relative shadow-sm hover:shadow-xl transition-shadow flex flex-col h-full`}>
                  {p.badge && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#082830] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">{p.badge}</div>}
                  <h3 className="text-2xl font-black mb-2">{p.name}</h3>
                  <p className="text-sm text-gray-500 mb-6 h-10">{p.description}</p>
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-gray-900">
                        LKR {yearly && p.monthlyPrice > 0 ? p.yearlyPrice.toLocaleString() : p.monthlyPrice.toLocaleString()}
                      </span>
                      <span className="text-gray-500 font-medium">{p.monthlyPrice === 0 ? 'forever' : yearly && p.monthlyPrice > 0 ? '/yr' : '/mo'}</span>
                    </div>
                    {yearly && p.monthlyPrice > 0 && (
                      <p className="text-sm text-[#00C750] font-semibold mt-1">2 months free</p>
                    )}
                  </div>
                  <ul className="space-y-4 flex-1 mb-8">
                    {p.features.map((f: any, j: number) => (
                      <li key={j} className="flex items-center justify-between text-sm font-medium text-gray-700 border-b border-[#E5E7EB]/50 pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 bg-[#E6FDF0] text-[#00C750] rounded-full flex items-center justify-center shrink-0">
                            <MdCheck className="w-3 h-3" />
                          </div>
                          <span>{f.label}</span>
                        </div>
                        <span className="font-bold text-gray-900 text-right">{f.value}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" className={`w-full py-3 rounded-xl font-bold text-center mt-auto transition-colors ${p.highlight ? 'bg-[#00E35B] text-[#041418] hover:bg-[#00C750]' : 'bg-[#082830] text-white hover:bg-black'}`}>
                    {p.monthlyPrice === 0 ? 'Get Started' : 'Buy Now'}
                  </Link>
                </div>
              ))}
            </div>

            {/* INTERACTIVE PLAN FINDER WIDGET */}
            <div className="max-w-5xl mx-auto mb-16">
              <div className="text-center mb-6">
                <h3 className="text-2xl md:text-3xl font-black text-[#082830] mb-2">
                  <span className="text-[#00E35B]">Not sure</span> which plan you need?
                </h3>
                <p className="text-gray-500 max-w-lg mx-auto text-sm">
                  Adjust your total invoice volume, active clients, and feature needs to get an instant tailored recommendation.
                </p>
              </div>
              <PlanFinderWidget />
            </div>

            <div className="max-w-5xl mx-auto bg-white rounded-3xl p-8 md:p-10 border border-[#E5E7EB] shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-left">
                <h3 className="text-2xl font-black mb-2 text-[#082830]">Enterprise & Custom</h3>
                <p className="text-gray-500 mb-4 max-w-2xl">Need something specific? We can build custom features, tailor-made reports, and specialized integrations designed exactly for your business workflow.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-[#007A31] font-bold text-sm bg-[#E6FDF0] px-3 py-1.5 rounded-lg w-fit border border-[#00E35B]/20">
                    <MdCheck /> Request custom features
                  </div>
                  <div className="flex items-center gap-1.5 text-[#007A31] font-bold text-sm bg-[#E6FDF0] px-3 py-1.5 rounded-lg w-fit border border-[#00E35B]/20">
                    <MdCheck /> Dedicated support
                  </div>
                </div>
              </div>
              <div className="shrink-0 w-full md:w-auto">
                <Link href="#contact" className="block w-full md:w-auto px-8 py-4 bg-transparent border-2 border-[#082830] text-[#082830] font-bold rounded-xl text-center hover:bg-[#082830] hover:text-white transition-colors">
                  Contact Sales
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="py-24 bg-[#F9FAFB]">
          <div className="container mx-auto px-4 sm:px-6 max-w-6xl xl:max-w-7xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black mb-4">Frequently Asked Questions<span className="text-[#00E35B]">.</span></h2>
              <p className="text-gray-600">Everything you need to know about Framebooks.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
              {faqs.map((faq, index) => {
                const isOpen = openFaqs.includes(index);
                return (
                  <div
                    key={index}
                    className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 shadow-xs hover:shadow-md ${
                      isOpen ? 'border-[#00E35B]/60 ring-2 ring-[#00E35B]/15' : 'border-[#E5E7EB] hover:border-gray-300'
                    }`}
                  >
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full text-left p-6 flex items-start justify-between gap-4 focus:outline-none cursor-pointer"
                    >
                      <span className="font-bold text-gray-900 text-base leading-snug">{faq.q}</span>
                      <span className={`text-[#00E35B] transition-transform duration-300 flex-shrink-0 mt-0.5 ${isOpen ? 'rotate-180' : ''}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="px-6 pb-6 pt-0 text-gray-600 text-sm leading-relaxed border-t border-[#F3F4F6] mt-1 pt-4">
                            {faq.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="contact" className="py-12 md:py-16 bg-white">
          <div className="container mx-auto px-4 sm:px-6 max-w-6xl xl:max-w-7xl">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#00E35B] via-[#05E863] to-[#26F29C] border border-[#00C750]/30 shadow-xl shadow-[#00E35B]/15 px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-10">
              {/* Decorative Background Elements */}
              <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/35 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-[#041418]/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-64 h-64 bg-emerald-300/30 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-10">
                {/* Left: Text Content */}
                <div className="max-w-2xl text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#041418]/10 text-[#041418] text-xs font-bold uppercase tracking-wider mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#041418] animate-pulse" />
                    Get Started Today
                  </div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#041418] tracking-tight leading-tight mb-2.5">
                    Ready to put your finances in order?
                  </h2>
                  <p className="text-[#041418]/85 text-sm sm:text-base font-medium leading-relaxed max-w-xl">
                    Join hundreds of Sri Lankan businesses that use Framebooks to manage their accounting, invoicing, and inventory effortlessly.
                  </p>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center lg:items-end xl:items-center gap-3 shrink-0">
                  <Link
                    href="/login"
                    className="px-7 py-3.5 bg-[#041418] hover:bg-black text-white font-bold rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#041418]/20 flex items-center justify-center gap-2 text-center"
                  >
                    <span>Start Free</span>
                    <MdArrowForward className="w-4 h-4" />
                  </Link>
                  <Link
                    href="#contact"
                    className="px-7 py-3.5 bg-white/40 hover:bg-white/70 border border-[#041418]/15 text-[#041418] font-bold rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98] text-center backdrop-blur-xs"
                  >
                    Talk to us
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
