"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { MdCheck, MdInsertDriveFile, MdGroup, MdAccountBalance, MdInventory, MdTrendingUp, MdSecurity, MdPointOfSale } from 'react-icons/md';
import { recommendPlan } from '@/lib/plan-finder';
import { plans as fallbackPlans } from '@/data/landing/content';

export interface PlanFinderWidgetProps {
  plans?: Array<{
    name: string;
    monthlyPrice: number;
    yearlyPrice?: number;
    description?: string;
    features?: any[];
  }>;
  isYearly?: boolean;
}

export default function PlanFinderWidget({ plans: propPlans, isYearly = false }: PlanFinderWidgetProps = {}) {
  const [plans, setPlans] = useState(propPlans || fallbackPlans);
  const [invoices, setInvoices] = useState(100);
  const [clients, setClients] = useState(50);
  const [accounts, setAccounts] = useState(2);
  const [needsInventory, setNeedsInventory] = useState(false);
  const [needsAdvancedReports, setNeedsAdvancedReports] = useState(true);
  const [needsAuditLogs, setNeedsAuditLogs] = useState(false);
  const [needsPos, setNeedsPos] = useState(false);

  useEffect(() => {
    if (propPlans && propPlans.length > 0) {
      setPlans(propPlans);
    } else {
      fetch('/api/plans')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setPlans(data);
          }
        })
        .catch(() => {});
    }
  }, [propPlans]);

  const recommendation = recommendPlan(invoices, clients, accounts, needsInventory, needsAdvancedReports, needsAuditLogs, needsPos);

  const matchedPlan = (plans || fallbackPlans).find(
    (p) => p.name.toLowerCase() === recommendation.plan.toLowerCase()
  );

  const basePriceNum =
    isYearly && matchedPlan && matchedPlan.monthlyPrice > 0
      ? matchedPlan.yearlyPrice || matchedPlan.monthlyPrice * 10
      : matchedPlan?.monthlyPrice ??
        (recommendation.plan === 'Free' ? 0 : recommendation.plan === 'Pro' ? 2600 : 5200);

  const posAddonPrice = needsPos ? (isYearly ? 30000 : 3000) : 0;
  const totalPriceNum = basePriceNum + posAddonPrice;

  const posFeature = needsPos
    ? `Cloud POS Add-on (+${(isYearly ? 30000 : 3000).toLocaleString()} LKR/${isYearly ? 'yr' : 'mo'})`
    : 'Cloud POS Add-on compatible';

  const planFeatures: Record<string, string[]> = {
    Free: [
      'Up to 50 invoices (lifetime)',
      'Up to 50 active clients',
      '2 bank/cash accounts',
      'Standard financial reporting',
    ],
    Pro: [
      'Unlimited invoices',
      'Unlimited active clients',
      '2 bank/cash accounts',
      'Advanced P&L & Cash Flow reports',
      posFeature,
    ],
    'Pro Plus': [
      'Unlimited invoices & clients',
      'Unlimited bank & cash accounts',
      'Unlimited team members & roles',
      'Complete inventory tracking',
      posFeature,
      'System audit logs & priority support',
    ],
  };

  const planDetails = {
    price: totalPriceNum === 0 ? '0 LKR' : `${totalPriceNum.toLocaleString()} LKR`,
    period: totalPriceNum === 0 ? 'forever free' : isYearly ? 'per year' : 'per month',
    features: planFeatures[recommendation.plan] || planFeatures.Free,
    posBreakdown: needsPos
      ? `${matchedPlan?.name || recommendation.plan} (${basePriceNum.toLocaleString()} LKR) + POS (${posAddonPrice.toLocaleString()} LKR)`
      : null,
  };

  return (
    <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 shadow-xs sm:shadow-sm relative overflow-hidden flex flex-col lg:flex-row gap-5 sm:gap-6 items-stretch my-4 sm:my-6">
      {/* Background Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#00E35B]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* LEFT COLUMN: Controls */}
      <div className="flex-1 space-y-3 sm:space-y-3.5 relative z-10 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
          <span className="text-[11px] font-black uppercase tracking-wider text-gray-500">
            Volume & Needs
          </span>
          <button
            type="button"
            onClick={() => {
              setInvoices(100);
              setClients(50);
              setAccounts(2);
              setNeedsInventory(false);
              setNeedsAdvancedReports(true);
              setNeedsAuditLogs(false);
              setNeedsPos(false);
            }}
            className="text-[11px] font-semibold text-gray-400 hover:text-[#00C750] transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Slider 1: Invoices */}
        <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-3.5 border border-[#E5E7EB] shadow-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#E6FDF0] text-[#007A31] flex items-center justify-center shrink-0">
                <MdInsertDriveFile className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-[#082830]">Invoices</span>
            </div>

            {/* Predefined values right next to name & badge */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1 bg-gray-50 p-0.5 rounded-full border border-gray-100">
                {[10, 25, 50, 100, 200].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setInvoices(val)}
                    className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-all ${
                      invoices === val
                        ? 'bg-[#082830] text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/60'
                    }`}
                  >
                    {val === 200 ? '200+' : val}
                  </button>
                ))}
              </div>
              <span className="px-2 py-0.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full text-[10px] sm:text-[11px] font-black text-[#082830] shrink-0">
                {invoices >= 200 ? '200+ inv' : `${invoices} inv`}
              </span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="200"
            step="5"
            value={invoices}
            onChange={(e) => setInvoices(parseInt(e.target.value))}
            className="w-full h-1.5 sm:h-2 rounded-lg appearance-none cursor-pointer accent-[#00E35B]"
            style={{
              background: `linear-gradient(to right, #00E35B 0%, #00E35B ${(invoices / 200) * 100}%, #E5E7EB ${(invoices / 200) * 100}%, #E5E7EB 100%)`,
            }}
          />
        </div>

        {/* Slider 2: Clients */}
        <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-3.5 border border-[#E5E7EB] shadow-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#E6FDF0] text-[#007A31] flex items-center justify-center shrink-0">
                <MdGroup className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-[#082830]">Active Clients</span>
            </div>

            {/* Predefined values right next to name & badge */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1 bg-gray-50 p-0.5 rounded-full border border-gray-100">
                {[10, 25, 50, 75, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setClients(val)}
                    className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-all ${
                      clients === val
                        ? 'bg-[#082830] text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/60'
                    }`}
                  >
                    {val === 100 ? '100+' : val}
                  </button>
                ))}
              </div>
              <span className="px-2 py-0.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full text-[10px] sm:text-[11px] font-black text-[#082830] shrink-0">
                {clients >= 100 ? '100+' : clients} clients
              </span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={clients}
            onChange={(e) => setClients(parseInt(e.target.value))}
            className="w-full h-1.5 sm:h-2 rounded-lg appearance-none cursor-pointer accent-[#00E35B]"
            style={{
              background: `linear-gradient(to right, #00E35B 0%, #00E35B ${(clients / 100) * 100}%, #E5E7EB ${(clients / 100) * 100}%, #E5E7EB 100%)`,
            }}
          />
        </div>

        {/* Slider 3: Accounts */}
        <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-3.5 border border-[#E5E7EB] shadow-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#E6FDF0] text-[#007A31] flex items-center justify-center shrink-0">
                <MdAccountBalance className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-[#082830]">Bank & Cash Accounts</span>
            </div>

            {/* Predefined values right next to name & badge */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1 bg-gray-50 p-0.5 rounded-full border border-gray-100">
                {[1, 2, 3, 5, 10].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAccounts(val)}
                    className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-all ${
                      accounts === val
                        ? 'bg-[#082830] text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/60'
                    }`}
                  >
                    {val === 10 ? '10+' : val}
                  </button>
                ))}
              </div>
              <span className="px-2 py-0.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full text-[10px] sm:text-[11px] font-black text-[#082830] shrink-0">
                {accounts} {accounts === 1 ? 'acc' : 'accs'}
              </span>
            </div>
          </div>

          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={accounts}
            onChange={(e) => setAccounts(parseInt(e.target.value))}
            className="w-full h-1.5 sm:h-2 rounded-lg appearance-none cursor-pointer accent-[#00E35B]"
            style={{
              background: `linear-gradient(to right, #00E35B 0%, #00E35B ${((accounts - 1) / 9) * 100}%, #E5E7EB ${((accounts - 1) / 9) * 100}%, #E5E7EB 100%)`,
            }}
          />
        </div>

        {/* Feature Toggles (Compact 3-column Grid) */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">
            Required Features
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
            {[
              {
                id: 'pos',
                label: 'Point of Sale (POS)',
                icon: MdPointOfSale,
                checked: needsPos,
                onChange: setNeedsPos,
              },
              {
                id: 'inventory',
                label: 'Inventory Management',
                icon: MdInventory,
                checked: needsInventory,
                onChange: setNeedsInventory,
              },
              {
                id: 'reports',
                label: 'Advanced Reports',
                icon: MdTrendingUp,
                checked: needsAdvancedReports,
                onChange: setNeedsAdvancedReports,
              },
              {
                id: 'audit',
                label: 'System Audit Logs',
                icon: MdSecurity,
                checked: needsAuditLogs,
                onChange: setNeedsAuditLogs,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => item.onChange(!item.checked)}
                  className={`p-2.5 sm:p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    item.checked
                      ? 'bg-[#E6FDF0] border-[#00E35B] shadow-xs'
                      : 'bg-white border-[#E5E7EB] hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                        item.checked
                          ? 'bg-[#00E35B] text-[#041418]'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-bold text-[#082830] whitespace-normal leading-tight">
                      {item.label}
                    </p>
                  </div>
                  <div
                    className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                      item.checked ? 'bg-[#00E35B]' : 'bg-gray-200'
                    }`}
                  >
                    <div
                      className={`bg-white w-3.5 h-3.5 rounded-full shadow-xs transform transition-transform ${
                        item.checked ? 'translate-x-3.5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Recommendation Showcase */}
      <div className="lg:w-[320px] shrink-0 bg-white text-gray-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col justify-between shadow-xl relative overflow-hidden border-2 border-[#00E35B] ring-4 ring-[#00E35B]/10">
        {/* Inner ambient glow */}
        <div className="absolute top-0 right-0 w-56 h-56 bg-[#00E35B]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E6FDF0] border border-[#00E35B]/30 text-[#007A31] text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-3 sm:mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E35B] animate-pulse" />
            Recommended for you
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={recommendation.plan}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-[#082830] mb-1">
                {recommendation.plan}
                <span className="text-[#00E35B]">.</span>
              </h3>

              <div className="flex flex-col mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-[#E5E7EB]">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-black text-[#007A31]">
                    {planDetails.price}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    / {planDetails.period}
                  </span>
                </div>
                {planDetails.posBreakdown && (
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-brand-400 mt-1">
                    Includes {planDetails.posBreakdown}
                  </p>
                )}
              </div>

              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-2.5 sm:p-3 mb-3 sm:mb-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                  Why this plan?
                </p>
                <p className="text-xs text-gray-700 leading-snug font-medium">
                  {recommendation.reason}
                </p>
              </div>

              <div className="space-y-2 mb-4 sm:mb-5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Included in {recommendation.plan}:
                </p>
                {planDetails.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-gray-700 font-medium">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#E6FDF0] text-[#007A31] flex items-center justify-center shrink-0 mt-0.5">
                      <MdCheck className="w-2.5 h-2.5" />
                    </div>
                    <span className="leading-tight">{feat}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative z-10 pt-3 border-t border-[#E5E7EB] flex flex-col gap-2">
          <Link
            href="/login"
            className="w-full py-2.5 sm:py-3 bg-[#00E35B] hover:bg-[#00C750] active:scale-[0.98] text-[#041418] font-black rounded-xl text-center text-xs sm:text-sm transition-all shadow-md shadow-[#00E35B]/20"
          >
            Get started with {recommendation.plan}{needsPos ? ' + POS' : ''}
          </Link>
          <Link
            href="/#pricing"
            className="text-center text-[11px] font-semibold text-gray-500 hover:text-[#082830] transition-colors py-0.5"
          >
            Compare all features & pricing →
          </Link>
        </div>
      </div>
    </div>
  );
}
