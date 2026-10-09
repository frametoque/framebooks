"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { MdCheck, MdInsertDriveFile, MdGroup, MdAccountBalance, MdInventory, MdTrendingUp, MdSecurity } from 'react-icons/md';
import { recommendPlan } from '@/lib/plan-finder';

export default function PlanFinderWidget() {
  const [invoices, setInvoices] = useState(100);
  const [clients, setClients] = useState(50);
  const [accounts, setAccounts] = useState(2);
  const [needsInventory, setNeedsInventory] = useState(false);
  const [needsAdvancedReports, setNeedsAdvancedReports] = useState(true);
  const [needsAuditLogs, setNeedsAuditLogs] = useState(false);

  const recommendation = recommendPlan(invoices, clients, accounts, needsInventory, needsAdvancedReports, needsAuditLogs);

  const planDetails = {
    Free: {
      price: '0 LKR',
      period: 'forever free',
      features: [
        'Up to 50 invoices (lifetime)',
        'Up to 50 active clients',
        '2 bank/cash accounts',
        'Standard financial reporting',
      ],
    },
    Pro: {
      price: '2,500 LKR',
      period: 'per month',
      features: [
        'Unlimited invoices',
        'Unlimited active clients',
        '2 bank/cash accounts',
        'Advanced P&L & Cash Flow reports',
      ],
    },
    'Pro Plus': {
      price: '5,000 LKR',
      period: 'per month',
      features: [
        'Unlimited invoices & clients',
        'Unlimited bank & cash accounts',
        'Unlimited team members & roles',
        'Complete inventory tracking',
        'System audit logs & priority support',
      ],
    },
  }[recommendation.plan];

  return (
    <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[2.5rem] p-6 sm:p-8 lg:p-10 shadow-sm relative overflow-hidden flex flex-col lg:flex-row gap-8 items-stretch my-8">
      {/* Background Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#00E35B]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* LEFT COLUMN: Controls */}
      <div className="flex-1 space-y-6 relative z-10">
        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
          <span className="text-xs font-black uppercase tracking-wider text-gray-500">
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
            }}
            className="text-xs font-semibold text-gray-400 hover:text-[#00C750] transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Slider 1: Invoices */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E6FDF0] text-[#007A31] flex items-center justify-center">
                <MdInsertDriveFile className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#082830]">Invoices</p>
                <p className="text-[11px] text-gray-400 font-medium">Lifetime count</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full text-xs font-black text-[#082830]">
              {invoices >= 200 ? '200+ invoices' : `${invoices} invoices`}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            step="5"
            value={invoices}
            onChange={(e) => setInvoices(parseInt(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#00E35B]"
            style={{
              background: `linear-gradient(to right, #00E35B 0%, #00E35B ${(invoices / 200) * 100}%, #E5E7EB ${(invoices / 200) * 100}%, #E5E7EB 100%)`,
            }}
          />
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
            <div className="flex gap-1.5">
              {[10, 25, 50, 100, 200].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setInvoices(val)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${invoices === val
                    ? 'bg-[#082830] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {val === 200 ? '200+' : val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Slider 2: Clients */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E6FDF0] text-[#007A31] flex items-center justify-center">
                <MdGroup className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#082830]">Active Clients</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full text-xs font-black text-[#082830]">
              {clients} {clients >= 100 ? '100+' : 'clients'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={clients}
            onChange={(e) => setClients(parseInt(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#00E35B]"
            style={{
              background: `linear-gradient(to right, #00E35B 0%, #00E35B ${(clients / 100) * 100}%, #E5E7EB ${(clients / 100) * 100}%, #E5E7EB 100%)`,
            }}
          />
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
            <span className="text-[11px] font-medium text-gray-400">Presets:</span>
            <div className="flex gap-1.5">
              {[10, 25, 50, 75, 100].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setClients(val)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${clients === val
                    ? 'bg-[#082830] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {val === 100 ? '100+' : val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Slider 3: Accounts */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E6FDF0] text-[#007A31] flex items-center justify-center">
                <MdAccountBalance className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#082830]">Bank & Cash Accounts</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full text-xs font-black text-[#082830]">
              {accounts} {accounts === 1 ? 'account' : 'accounts'}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={accounts}
            onChange={(e) => setAccounts(parseInt(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#00E35B]"
            style={{
              background: `linear-gradient(to right, #00E35B 0%, #00E35B ${((accounts - 1) / 9) * 100}%, #E5E7EB ${((accounts - 1) / 9) * 100}%, #E5E7EB 100%)`,
            }}
          />
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
            <span className="text-[11px] font-medium text-gray-400">Presets:</span>
            <div className="flex gap-1.5">
              {[1, 2, 3, 5, 10].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAccounts(val)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${accounts === val
                    ? 'bg-[#082830] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {val === 10 ? '10+' : val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="pt-2 space-y-3">
          <p className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
            Required Features
          </p>

          {[
            {
              id: 'inventory',
              label: 'Inventory Management',
              icon: MdInventory,
              checked: needsInventory,
              onChange: setNeedsInventory,
            },
            {
              id: 'reports',
              label: 'Advanced Financial Reports',
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
                className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${item.checked
                  ? 'bg-[#E6FDF0] border-[#00E35B] shadow-xs'
                  : 'bg-white border-[#E5E7EB] hover:border-gray-300'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${item.checked
                      ? 'bg-[#00E35B] text-[#041418]'
                      : 'bg-gray-100 text-gray-500'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#082830]">{item.label}</p>
                  </div>
                </div>
                <div
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${item.checked ? 'bg-[#00E35B]' : 'bg-gray-200'
                    }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${item.checked ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN: Recommendation Showcase */}
      <div className="lg:w-[340px] shrink-0 bg-white text-gray-900 rounded-[2rem] p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden border-2 border-[#00E35B] ring-4 ring-[#00E35B]/10">
        {/* Inner ambient glow */}
        <div className="absolute top-0 right-0 w-56 h-56 bg-[#00E35B]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6FDF0] border border-[#00E35B]/30 text-[#007A31] text-xs font-bold uppercase tracking-wider mb-6">
            <span className="w-2 h-2 rounded-full bg-[#00E35B] animate-pulse" />
            Recommended for you
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={recommendation.plan}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-[#082830] mb-2">
                {recommendation.plan}
                <span className="text-[#00E35B]">.</span>
              </h3>

              <div className="flex items-baseline gap-2 mb-6 pb-6 border-b border-[#E5E7EB]">
                <span className="text-2xl font-black text-[#007A31]">
                  {planDetails.price}
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  / {planDetails.period}
                </span>
              </div>

              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-4 mb-6">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Why this plan?
                </p>
                <p className="text-sm text-gray-700 leading-relaxed font-medium">
                  {recommendation.reason}
                </p>
              </div>

              <div className="space-y-3 mb-8">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Included in {recommendation.plan}:
                </p>
                {planDetails.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-700 font-medium">
                    <div className="w-4 h-4 rounded-full bg-[#E6FDF0] text-[#007A31] flex items-center justify-center shrink-0 mt-0.5">
                      <MdCheck className="w-3 h-3" />
                    </div>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative z-10 pt-4 border-t border-[#E5E7EB] flex flex-col gap-3">
          <Link
            href="/login"
            className="w-full py-3.5 bg-[#00E35B] hover:bg-[#00C750] text-[#041418] font-black rounded-xl text-center text-sm transition-all hover:scale-[1.02] shadow-md shadow-[#00E35B]/20"
          >
            Get started with {recommendation.plan}
          </Link>
          <Link
            href="/#pricing"
            className="text-center text-xs font-semibold text-gray-500 hover:text-[#082830] transition-colors py-1"
          >
            Compare all features & pricing →
          </Link>
        </div>
      </div>
    </div>
  );
}
