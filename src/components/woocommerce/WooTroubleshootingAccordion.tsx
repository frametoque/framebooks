"use client";

import React, { useState } from "react";
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Wrench,
} from "lucide-react";
import { WOO_GUIDE_CONTENT, TroubleshootingItem, FaqItem } from "@/lib/woocommerce/guide-content";

interface WooTroubleshootingAccordionProps {
  defaultOpen?: boolean;
}

export default function WooTroubleshootingAccordion({
  defaultOpen = false,
}: WooTroubleshootingAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [openTroubleshootId, setOpenTroubleshootId] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setOpenFaqId((prev) => (prev === id ? null : id));
  };

  const toggleTroubleshoot = (id: string) => {
    setOpenTroubleshootId((prev) => (prev === id ? null : id));
  };

  const { faqs, troubleshooting } = WOO_GUIDE_CONTENT;

  return (
    <div className="rounded-3xl bg-card border border-border overflow-hidden">
      {/* Accordion Header / Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full p-5 flex items-center justify-between text-left cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Help & FAQs</h3>
            <p className="text-xs text-gray-400">Quick answers and error fixes</p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-5 pt-0 space-y-4 border-t border-border animate-in fade-in duration-150">
          {/* FAQ Items */}
          <div className="space-y-2 pt-4">
            {faqs.map((faq: FaqItem) => {
              const isFaqOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="border border-border rounded-xl overflow-hidden bg-black/5 dark:bg-white/5"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(faq.id)}
                    className="w-full p-3 flex items-center justify-between text-left cursor-pointer hover:bg-black/10 transition-colors"
                  >
                    <span className="text-xs font-semibold text-foreground pr-2">{faq.question}</span>
                    {isFaqOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    )}
                  </button>

                  {isFaqOpen && (
                    <div className="px-3 pb-3 text-xs text-gray-300 leading-relaxed border-t border-border/50 pt-2">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Common Errors Disclosure */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-foreground">Common error fixes</span>
            </div>

            <div className="space-y-1.5">
              {troubleshooting.map((item: TroubleshootingItem) => {
                const isErrOpen = openTroubleshootId === item.id;
                return (
                  <div
                    key={item.id}
                    className="border border-border rounded-xl overflow-hidden bg-black/5 dark:bg-white/5"
                  >
                    <button
                      type="button"
                      onClick={() => toggleTroubleshoot(item.id)}
                      className="w-full p-2.5 flex items-center justify-between text-left cursor-pointer hover:bg-black/10 transition-colors"
                    >
                      <div className="flex items-center gap-2 pr-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-amber-500 font-bold shrink-0">
                          {item.errorCode.split(" ")[0]}
                        </span>
                        <span className="text-xs font-medium text-foreground">{item.title}</span>
                      </div>
                      {isErrOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      )}
                    </button>

                    {isErrOpen && (
                      <div className="p-3 pt-1 border-t border-border/50 text-xs text-gray-300 space-y-2">
                        <p className="text-red-400">{item.symptom}</p>
                        <p className="text-gray-200">
                          <strong>Fix:</strong> {item.fix}
                        </p>
                        {item.wpPath && (
                          <p className="text-[11px] text-gray-400">
                            Location: <code className="text-foreground">{item.wpPath}</code>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
