"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  MdOutlineTimer,
  MdCheckCircle,
  MdThumbUp,
  MdThumbDown,
  MdKeyboardArrowRight,
  MdCheck,
  MdClose,
  MdArrowForward,
} from 'react-icons/md';
import { GuideArticle } from '@/lib/guide-content';
import {
  comparisonTable,
  invoiceStatuses,
  quotationTimeline,
} from '@/lib/help-content';
import PlanFinderWidget from '@/components/landing/PlanFinderWidget';

export default function ArticleView({
  article,
  groupTitle,
}: {
  article: GuideArticle;
  groupTitle: string;
}) {
  const [feedbackState, setFeedbackState] = useState<'idle' | 'submitted'>('idle');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl"
    >
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">
        <span>Guide</span>
        <MdKeyboardArrowRight />
        <span>{groupTitle}</span>
      </div>

      {/* TITLE & META */}
      <h1 className="text-3xl md:text-5xl font-black mb-4 text-[#082830] tracking-tight">
        {article.title}
        <span className="text-[#00E35B]">.</span>
      </h1>

      <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-gray-500 mb-8 pb-8 border-b border-gray-100">
        <div className="flex items-center gap-1.5">
          <MdOutlineTimer className="w-4 h-4 text-[#00E35B]" /> {article.readTime}
        </div>
        {article.plan && (
          <div className="px-2.5 py-1 bg-[#082830] text-[#00E35B] rounded-full text-xs font-bold uppercase tracking-widest">
            {article.plan} Plan
          </div>
        )}
      </div>

      {/* INTRO */}
      <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-10">
        {article.intro}
      </p>

      {/* INTERACTIVE WIDGET FOR PLAN FINDER */}
      {article.slug === 'plan-finder' && (
        <div className="my-8">
          <PlanFinderWidget />
        </div>
      )}

      {/* SPREADSHEETS VS FRAMEBOOKS TABLE */}
      {article.slug === 'spreadsheets-vs-framebooks' && (
        <div className="my-10 overflow-x-auto rounded-3xl border border-[#E5E7EB] bg-white shadow-xs">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="p-4 md:p-5 font-bold text-[#082830]">Capability</th>
                <th className="p-4 md:p-5 font-bold text-gray-400">Spreadsheets</th>
                <th className="p-4 md:p-5 font-bold text-[#007A31] bg-[#E6FDF0]">
                  Framebooks
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {comparisonTable.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 md:p-5 font-bold text-[#082830]">{row.feature}</td>
                  <td className="p-4 md:p-5 text-gray-500">
                    <div className="flex items-start gap-2">
                      <MdClose className="text-red-400 mt-0.5 shrink-0" />
                      <span>{row.spreadsheets}</span>
                    </div>
                  </td>
                  <td className="p-4 md:p-5 font-medium text-[#082830] bg-[#FAFEFC]">
                    <div className="flex items-start gap-2">
                      <MdCheck className="text-[#00E35B] mt-0.5 shrink-0" />
                      <span>{row.framebooks}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* INVOICE STATUSES GRID */}
      {article.slug === 'invoice-statuses' && (
        <div className="my-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          {invoiceStatuses.map((st) => (
            <div
              key={st.status}
              className="p-5 bg-white rounded-2xl border border-[#E5E7EB] shadow-xs flex flex-col justify-between"
            >
              <div>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 ${st.color}`}
                >
                  {st.status}
                </span>
                <p className="text-sm text-gray-600 mb-3">{st.description}</p>
              </div>
              <p className="text-xs font-semibold text-gray-400 border-t border-gray-100 pt-3">
                <strong className="text-gray-700">Action:</strong> {st.action}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* QUOTATION TIMELINE */}
      {article.slug === 'quotation-timeline' && (
        <div className="my-10 space-y-4">
          {quotationTimeline.map((item) => (
            <div
              key={item.step}
              className="p-5 bg-white rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-[#082830] text-[#00E35B] flex items-center justify-center font-black text-sm shrink-0">
                {item.step}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-base font-bold text-[#082830]">{item.title}</h4>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
                    {item.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STEP-BY-STEP ARTICLE CONTENT */}
      {article.steps && article.steps.length > 0 && !['invoice-statuses', 'quotation-timeline'].includes(article.slug) && (
        <div className="space-y-12 mb-16">
          {article.steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex gap-6"
            >
              <div className="shrink-0 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-[#E6FDF0] text-[#007A31] flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>
                {idx !== article.steps.length - 1 && (
                  <div className="w-px h-full bg-gray-100 my-2" />
                )}
              </div>
              <div className="pt-1 pb-8 flex-1">
                <h3
                  id={`step-${idx + 1}`}
                  className="text-xl font-bold mb-3 text-[#082830] scroll-mt-24 group relative"
                >
                  <a
                    href={`#step-${idx + 1}`}
                    className="absolute -left-6 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#00E35B]"
                  >
                    #
                  </a>
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed mb-4 text-base">
                  {step.content}
                </p>
                {step.bullets && (
                  <ul className="space-y-2 mt-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                    {step.bullets.map((b, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-gray-600">
                        <MdCheckCircle className="text-[#00E35B] shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* FEEDBACK STRIP */}
      <div className="bg-[#F9FAFB] rounded-2xl p-6 border border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-4">
        {feedbackState === 'idle' ? (
          <>
            <p className="font-bold text-gray-600 text-sm">Was this article helpful?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFeedbackState('submitted')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-colors text-sm font-bold text-gray-600"
              >
                <MdThumbUp /> Yes
              </button>
              <button
                type="button"
                onClick={() => setFeedbackState('submitted')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors text-sm font-bold text-gray-600"
              >
                <MdThumbDown /> No
              </button>
            </div>
          </>
        ) : (
          <p className="font-bold text-[#007A31] text-sm flex items-center gap-2">
            <MdCheckCircle /> Thanks for your feedback! It helps us improve the user guide.
          </p>
        )}
      </div>
    </motion.div>
  );
}
