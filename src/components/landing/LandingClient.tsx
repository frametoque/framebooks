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
        <section className="pt-24 sm:pt-28 md:pt-40 pb-14 sm:pb-20 md:pb-28 overflow-hidden px-4 sm:px-6">
          <div className="container mx-auto max-w-5xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-gray-200 bg-white shadow-xs mb-5 sm:mb-6 text-xs sm:text-sm font-semibold text-gray-700"
            >
              <span>Built for Sri Lanka</span> <span>🇱🇰</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.12] mb-4 sm:mb-6 text-[#082830]"
            >
              Run your whole business finances in one place<span className="text-[#00E35B]">.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed font-normal"
            >
              Invoices, quotations, expenses, bank accounts, clients, inventory and reports, all in one seamless dashboard built for modern teams.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 mb-6 sm:mb-8 w-full max-w-sm sm:max-w-none mx-auto"
            >
              <Link
                href="/login"
                className="w-full sm:w-auto px-7 py-3.5 sm:py-4 bg-[#00E35B] hover:bg-[#00C750] text-[#041418] font-bold rounded-full transition-all hover:scale-105 active:scale-95 shadow-md shadow-[#00E35B]/25 text-base sm:text-lg text-center flex items-center justify-center gap-2"
              >
                <span>Start Free</span>
                <MdArrowForward className="w-4 h-4" />
              </Link>
              <a
                href="#features"
                className="w-full sm:w-auto px-7 py-3.5 sm:py-4 bg-white hover:bg-gray-50 border border-gray-200 text-[#082830] font-bold rounded-full transition-colors active:scale-95 text-base sm:text-lg text-center"
              >
                See how it works
              </a>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-1.5 text-xs sm:text-sm text-gray-500 font-medium"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C750]" />
                End-to-end encryption
              </span>
              <span className="hidden sm:inline text-gray-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C750]" />
                No credit card needed
              </span>
              <span className="hidden sm:inline text-gray-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C750]" />
                Multi-account support
              </span>
            </motion.div>

            {/* Mockup visual */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
              className="mt-12 sm:mt-16 md:mt-20 relative mx-auto max-w-4xl"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-[#26F29C] to-blue-400 rounded-2xl sm:rounded-[2rem] blur opacity-20 pointer-events-none" />
              
              <div className="relative bg-white border border-[#E5E7EB] rounded-2xl sm:rounded-[2rem] shadow-xl md:shadow-2xl p-4 sm:p-6 md:p-8 flex flex-col overflow-hidden">
                {/* Header mock */}
                <div className="flex justify-between items-center mb-4 sm:mb-6 md:mb-8 pb-3 sm:pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-base sm:text-xl font-black text-[#082830]">Framebooks</span>
                    <span className="w-px h-4 sm:h-5 bg-gray-200" />
                    <span className="text-sm sm:text-lg font-bold text-gray-600">Dashboard</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <span className="text-xs sm:text-sm font-semibold text-gray-400 hidden sm:block">Thu, Oct 8, 2026</span>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#E6FDF0] text-[#007A31] rounded-full flex items-center justify-center font-bold text-xs sm:text-sm">
                      <MdPerson className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Body mock */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 mb-4 sm:mb-6">
                  {[
                    { label: 'Available Funds', value: '7.145M LKR', icon: <MdAccountBalance /> },
                    { label: 'Total Income', value: '6.055M LKR', icon: <MdCallReceived /> },
                    { label: 'Total Expenses', value: '984.7K LKR', icon: <MdCallMade /> },
                    { label: 'Net Profit', value: '5.07M LKR', icon: <MdTrendingUp /> }
                  ].map((stat, i) => (
                    <div key={i} className="bg-[#F9FAFB] rounded-xl sm:rounded-2xl border border-[#E5E7EB] p-2.5 sm:p-4 flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-[#00C750] shadow-xs shrink-0">
                          {stat.icon}
                        </div>
                        <span className="text-[10px] sm:text-xs font-semibold text-gray-500 truncate">{stat.label}</span>
                      </div>
                      <div className="text-sm sm:text-base md:text-lg font-black text-[#041418]">{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Charts mock */}
                <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-4">
                  {/* Income vs Expenses Card */}
                  <div className="flex-[1.8] bg-[#F9FAFB] rounded-xl sm:rounded-2xl border border-[#E5E7EB] p-3.5 sm:p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-[#082830]">Income vs Expenses</div>
                        <div className="text-[10px] text-gray-400 font-medium hidden sm:block">Monthly financial performance</div>
                      </div>
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#00E35B]" />
                          <span className="text-[10px] sm:text-xs font-semibold text-gray-500">Income</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                          <span className="text-[10px] sm:text-xs font-semibold text-gray-500">Expenses</span>
                        </div>
                      </div>
                    </div>

                    {/* Chart Container */}
                    <div className="relative h-32 sm:h-36 md:h-40 w-full flex flex-col justify-end pt-2">
                      {/* Grid Lines */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                        <div className="border-b border-dashed border-gray-200/90 w-full relative">
                          <span className="absolute -top-2 right-0 text-[9px] text-gray-400 font-mono">1.8M</span>
                        </div>
                        <div className="border-b border-dashed border-gray-200/90 w-full relative">
                          <span className="absolute -top-2 right-0 text-[9px] text-gray-400 font-mono">1.2M</span>
                        </div>
                        <div className="border-b border-dashed border-gray-200/90 w-full relative">
                          <span className="absolute -top-2 right-0 text-[9px] text-gray-400 font-mono">600K</span>
                        </div>
                        <div className="border-b border-gray-200 w-full" />
                      </div>

                      {/* Bar Columns */}
                      <div className="relative z-10 w-full h-[85%] flex items-end justify-between gap-1.5 sm:gap-3 pb-6">
                        {[
                          { month: 'May', inc: 72, exp: 32, incVal: '1.30M', expVal: '580K' },
                          { month: 'Jun', inc: 88, exp: 40, incVal: '1.60M', expVal: '720K' },
                          { month: 'Jul', inc: 55, exp: 26, incVal: '1.00M', expVal: '460K' },
                          { month: 'Aug', inc: 95, exp: 48, incVal: '1.75M', expVal: '860K' },
                          { month: 'Sep', inc: 78, exp: 36, incVal: '1.42M', expVal: '650K' },
                          { month: 'Oct', inc: 92, exp: 44, incVal: '1.68M', expVal: '790K' },
                        ].map((item, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer">
                            {/* Hover tooltip */}
                            <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none absolute -top-8 z-20 bg-[#082830] text-white text-[9px] sm:text-[10px] font-semibold py-1 px-2 rounded-lg shadow-lg whitespace-nowrap flex items-center gap-1.5">
                              <span className="text-[#00E35B]">+{item.incVal}</span>
                              <span className="text-gray-400">/</span>
                              <span className="text-red-400">-{item.expVal}</span>
                            </div>

                            {/* Bar pairs */}
                            <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-full">
                              <div
                                className="w-full max-w-[10px] sm:max-w-[14px] bg-gradient-to-t from-[#00C750] to-[#00E35B] rounded-t-sm sm:rounded-t-md transition-all duration-300 group-hover:brightness-110 shadow-xs"
                                style={{ height: `${item.inc}%` }}
                              />
                              <div
                                className="w-full max-w-[10px] sm:max-w-[14px] bg-gradient-to-t from-[#DC2626] to-[#EF4444] rounded-t-sm sm:rounded-t-md transition-all duration-300 group-hover:brightness-110 shadow-xs"
                                style={{ height: `${item.exp}%` }}
                              />
                            </div>

                            {/* Month Label */}
                            <span className="absolute -bottom-5 text-[10px] sm:text-xs font-semibold text-gray-500 group-hover:text-[#082830] transition-colors">
                              {item.month}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Expense Breakdown Card */}
                  <div className="flex-1 bg-[#F9FAFB] rounded-xl sm:rounded-2xl border border-[#E5E7EB] p-3.5 sm:p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-xs sm:text-sm font-bold text-[#082830]">Expense Breakdown</div>
                      <span className="text-[10px] font-bold text-gray-400">Oct 2026</span>
                    </div>

                    <div className="flex flex-col items-center justify-center my-auto py-2">
                      <div className="relative w-22 h-22 sm:w-26 sm:h-26 flex items-center justify-center">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#E5E7EB" strokeWidth="4.5" />
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            fill="none"
                            stroke="#00E35B"
                            strokeWidth="4.5"
                            strokeDasharray="52 48"
                            strokeDashoffset="0"
                            className="transition-all duration-500"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            fill="none"
                            stroke="#082830"
                            strokeWidth="4.5"
                            strokeDasharray="28 72"
                            strokeDashoffset="-52"
                            className="transition-all duration-500"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth="4.5"
                            strokeDasharray="20 80"
                            strokeDashoffset="-80"
                            className="transition-all duration-500"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-[9px] text-gray-400 font-medium">Total</span>
                          <span className="text-xs sm:text-sm font-black text-[#082830]">985K</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full mt-3 pt-2 border-t border-gray-100">
                        <div className="flex flex-col items-center text-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00E35B] mb-0.5" />
                          <span className="text-[9px] text-gray-400">Payroll</span>
                          <span className="text-[10px] font-bold text-[#082830]">52%</span>
                        </div>
                        <div className="flex flex-col items-center text-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#082830] mb-0.5" />
                          <span className="text-[9px] text-gray-400">SaaS</span>
                          <span className="text-[10px] font-bold text-[#082830]">28%</span>
                        </div>
                        <div className="flex flex-col items-center text-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] mb-0.5" />
                          <span className="text-[9px] text-gray-400">Ads</span>
                          <span className="text-[10px] font-bold text-[#082830]">20%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badges - safely positioned on mobile without overflowing viewport */}
              <div
                className="absolute -top-3 left-3 sm:top-1/4 sm:-left-6 md:-left-10 bg-white px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 flex items-center gap-2.5 z-20 animate-bounce"
                style={{ animationDuration: '3s' }}
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                  <MdCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] sm:text-xs text-gray-500 font-semibold">Invoice #1042</p>
                  <p className="font-bold text-xs sm:text-sm text-[#082830]">Paid in full</p>
                </div>
              </div>

              <div
                className="absolute -bottom-3 right-3 sm:bottom-1/4 sm:-right-6 md:-right-8 bg-[#00E35B] px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl shadow-lg border border-[#26F29C] flex items-center gap-2.5 z-20 animate-bounce"
                style={{ animationDuration: '4s', animationDelay: '1s' }}
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/25 text-[#041418] flex items-center justify-center shrink-0">
                  <MdTrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] sm:text-xs text-[#082830] font-bold opacity-80">Net Profit</p>
                  <p className="font-bold text-xs sm:text-sm text-[#041418]">+124.5%</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FEATURES (Previously Modules) */}
        <section id="features" className="py-16 sm:py-20 md:py-24 bg-[#F9FAFB]">
          <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
            <div className="text-center mb-10 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl font-black mb-3 sm:mb-4 tracking-tight">
                Everything your finances need.<br className="hidden sm:inline" /> Nothing they don't<span className="text-[#00E35B]">.</span>
              </h2>
              <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
                Everything you need to manage your business, neatly organized into powerful features.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
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
                  <div key={mod.id} className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-[#E5E7EB] shadow-xs hover:shadow-md transition-shadow group">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#F9FAFB] rounded-xl sm:rounded-2xl flex items-center justify-center mb-5 sm:mb-6 text-[#00C750] group-hover:scale-105 group-hover:bg-[#E6FDF0] transition-all">
                      <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black mb-4 sm:mb-6">{mod.title}</h3>
                    <ul className="space-y-3 sm:space-y-4">
                      {mod.benefits.map((b, j) => (
                        <li key={j} className="flex items-start gap-2.5 sm:gap-3 text-sm text-gray-600">
                          <div className="mt-0.5 shrink-0 text-[#00E35B]"><MdCheck className="w-4 h-4" /></div>
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
        <section id="pricing" className="py-16 sm:py-20 md:py-24 bg-[#F9FAFB]">
          <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
            <div className="text-center mb-10 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl font-black mb-3 sm:mb-4 tracking-tight">
                Start free. Upgrade when you grow<span className="text-[#00E35B]">.</span>
              </h2>
              <div className="flex items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-8">
                <span className={`text-sm sm:text-base font-semibold ${!yearly ? 'text-[#082830]' : 'text-gray-500'}`}>Monthly</span>
                <button
                  onClick={() => setYearly(!yearly)}
                  className="w-14 h-8 bg-[#082830] rounded-full p-1 relative transition-colors focus:outline-none focus:ring-2 focus:ring-[#00E35B]"
                  aria-label="Toggle annual billing"
                >
                  <div className={`w-6 h-6 bg-[#26F29C] rounded-full transition-transform ${yearly ? 'translate-x-6' : ''}`} />
                </button>
                <span className={`text-sm sm:text-base font-semibold flex items-center gap-1.5 ${yearly ? 'text-[#082830]' : 'text-gray-500'}`}>
                  Yearly
                  <span className="text-[11px] sm:text-xs font-bold text-[#007A31] bg-[#E6FDF0] px-2 py-0.5 rounded-full border border-[#00E35B]/20">
                    Save 20%
                  </span>
                </span>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${displayPlans.length === 1 ? 'max-w-md' :
                displayPlans.length === 2 ? 'max-w-3xl md:grid-cols-2' :
                  displayPlans.length === 4 ? 'max-w-7xl sm:grid-cols-2 lg:grid-cols-4' :
                    'max-w-5xl md:grid-cols-3'
              } gap-6 sm:gap-8 items-start mx-auto mb-12 sm:mb-16`}>
              {displayPlans.map((p, i) => (
                <div key={i} className={`bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border ${p.highlight ? 'border-[#00E35B] ring-2 ring-[#00E35B]/20' : 'border-[#E5E7EB]'} relative shadow-xs hover:shadow-lg transition-shadow flex flex-col h-full`}>
                  {p.badge && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#082830] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">{p.badge}</div>}
                  <h3 className="text-xl sm:text-2xl font-black mb-2">{p.name}</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mb-6 min-h-[32px] sm:h-10 leading-relaxed">{p.description}</p>
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                        LKR {yearly && p.monthlyPrice > 0 ? p.yearlyPrice.toLocaleString() : p.monthlyPrice.toLocaleString()}
                      </span>
                      <span className="text-gray-500 font-medium text-xs sm:text-sm">{p.monthlyPrice === 0 ? 'forever' : yearly && p.monthlyPrice > 0 ? '/yr' : '/mo'}</span>
                    </div>
                    {yearly && p.monthlyPrice > 0 && (
                      <p className="text-xs sm:text-sm text-[#00C750] font-semibold mt-1">2 months free</p>
                    )}
                  </div>
                  <ul className="space-y-3 sm:space-y-4 flex-1 mb-6 sm:mb-8">
                    {p.features.map((f: any, j: number) => (
                      <li key={j} className="flex items-center justify-between text-xs sm:text-sm font-medium text-gray-700 border-b border-[#E5E7EB]/50 pb-2.5 sm:pb-3 last:border-0 last:pb-0 gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-4 h-4 sm:w-5 sm:h-5 bg-[#E6FDF0] text-[#00C750] rounded-full flex items-center justify-center shrink-0">
                            <MdCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </div>
                          <span>{f.label}</span>
                        </div>
                        <span className="font-bold text-gray-900 text-right shrink-0">{f.value}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/login"
                    className={`w-full py-3 sm:py-3.5 rounded-xl font-bold text-center mt-auto transition-all active:scale-[0.98] ${
                      p.highlight
                        ? 'bg-[#00E35B] text-[#041418] hover:bg-[#00C750] shadow-md shadow-[#00E35B]/20'
                        : 'bg-[#082830] text-white hover:bg-black'
                    }`}
                  >
                    {p.monthlyPrice === 0 ? 'Get Started' : 'Buy Now'}
                  </Link>
                </div>
              ))}
            </div>

            {/* INTERACTIVE PLAN FINDER WIDGET */}
            <div className="max-w-5xl mx-auto mb-12 sm:mb-16">
              <div className="text-center mb-6">
                <h3 className="text-2xl sm:text-3xl font-black text-[#082830] mb-2 tracking-tight">
                  <span className="text-[#00E35B]">Not sure</span> which plan you need?
                </h3>
                <p className="text-gray-500 max-w-lg mx-auto text-xs sm:text-sm leading-relaxed px-4">
                  Adjust your total invoice volume, active clients, and feature needs to get an instant tailored recommendation.
                </p>
              </div>
              <PlanFinderWidget />
            </div>

            {/* Enterprise & Custom */}
            <div className="max-w-5xl mx-auto bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 border border-[#E5E7EB] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 md:gap-8">
              <div className="text-left">
                <h3 className="text-xl sm:text-2xl font-black mb-2 text-[#082830]">Enterprise & Custom</h3>
                <p className="text-xs sm:text-sm text-gray-500 mb-4 max-w-2xl leading-relaxed">
                  Need something specific? We can build custom features, tailor-made reports, and specialized integrations designed exactly for your business workflow.
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-1.5 text-[#007A31] font-bold text-xs sm:text-sm bg-[#E6FDF0] px-3 py-1.5 rounded-lg w-fit border border-[#00E35B]/20">
                    <MdCheck className="shrink-0" /> Request custom features
                  </div>
                  <div className="flex items-center gap-1.5 text-[#007A31] font-bold text-xs sm:text-sm bg-[#E6FDF0] px-3 py-1.5 rounded-lg w-fit border border-[#00E35B]/20">
                    <MdCheck className="shrink-0" /> Dedicated support
                  </div>
                </div>
              </div>
              <div className="shrink-0 w-full md:w-auto">
                <Link
                  href="#contact"
                  className="block w-full md:w-auto px-7 py-3.5 bg-transparent border-2 border-[#082830] text-[#082830] font-bold rounded-xl text-center hover:bg-[#082830] hover:text-white active:scale-[0.98] transition-all text-sm sm:text-base"
                >
                  Contact Sales
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="py-16 sm:py-20 md:py-24 bg-[#F9FAFB]">
          <div className="container mx-auto px-4 sm:px-6 max-w-6xl xl:max-w-7xl">
            <div className="text-center mb-10 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl font-black mb-3 sm:mb-4 tracking-tight">
                Frequently Asked Questions<span className="text-[#00E35B]">.</span>
              </h2>
              <p className="text-sm sm:text-base text-gray-600">Everything you need to know about Framebooks.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
              {faqs.map((faq, index) => {
                const isOpen = openFaqs.includes(index);
                return (
                  <div
                    key={index}
                    className={`bg-white border rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-200 shadow-xs hover:shadow-md ${
                      isOpen ? 'border-[#00E35B]/60 ring-2 ring-[#00E35B]/15' : 'border-[#E5E7EB] hover:border-gray-300'
                    }`}
                  >
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full text-left p-4.5 sm:p-6 flex items-start justify-between gap-3 sm:gap-4 focus:outline-none cursor-pointer"
                    >
                      <span className="font-bold text-gray-900 text-sm sm:text-base leading-snug">{faq.q}</span>
                      <span className={`text-[#00E35B] transition-transform duration-300 shrink-0 mt-0.5 ${isOpen ? 'rotate-180' : ''}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
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
                          <div className="px-4.5 sm:px-6 pb-5 sm:pb-6 text-gray-600 text-xs sm:text-sm leading-relaxed border-t border-[#F3F4F6] mt-1 pt-3.5 sm:pt-4">
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
        <section id="contact" className="py-10 sm:py-14 md:py-16 bg-white">
          <div className="container mx-auto px-4 sm:px-6 max-w-6xl xl:max-w-7xl">
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#00E35B] via-[#05E863] to-[#26F29C] border border-[#00C750]/30 shadow-xl shadow-[#00E35B]/15 px-5 py-7 sm:px-10 sm:py-10 lg:px-12 lg:py-10">
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
                  <p className="text-[#041418]/85 text-xs sm:text-base font-medium leading-relaxed max-w-xl">
                    Join hundreds of Sri Lankan businesses that use Framebooks to manage their accounting, invoicing, and inventory effortlessly.
                  </p>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                  <Link
                    href="/login"
                    className="w-full sm:w-auto px-7 py-3.5 bg-[#041418] hover:bg-black text-white font-bold rounded-xl text-sm sm:text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#041418]/20 flex items-center justify-center gap-2 text-center"
                  >
                    <span>Start Free</span>
                    <MdArrowForward className="w-4 h-4" />
                  </Link>
                  <Link
                    href="#contact"
                    className="w-full sm:w-auto px-7 py-3.5 bg-white/40 hover:bg-white/70 border border-[#041418]/15 text-[#041418] font-bold rounded-xl text-sm sm:text-base transition-all hover:scale-[1.02] active:scale-[0.98] text-center backdrop-blur-xs"
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
