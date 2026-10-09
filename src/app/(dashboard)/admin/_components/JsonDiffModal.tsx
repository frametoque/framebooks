// src/components/admin/JsonDiffModal.tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Code2 } from "lucide-react";

interface JsonDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  before: any;
  after: any;
}

export function JsonDiffModal({
  isOpen,
  onClose,
  title,
  before,
  after,
}: JsonDiffModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-card border border-border rounded-3xl p-6 max-w-3xl w-full shadow-2xl relative flex flex-col max-h-[85vh]"
          >
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Code2 className="w-5 h-5 text-brand-500" />
                <h3 className="text-lg font-bold text-foreground">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 overflow-y-auto flex-1">
              {/* Before State */}
              <div className="flex flex-col">
                <div className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-2">
                  Before State
                </div>
                <div className="flex-1 bg-black/5 dark:bg-black/30 rounded-2xl p-4 font-mono text-xs overflow-auto border border-border text-foreground">
                  <pre>{before ? JSON.stringify(before, null, 2) : "null / none"}</pre>
                </div>
              </div>

              {/* After State */}
              <div className="flex flex-col">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-green-400 mb-2">
                  After State
                </div>
                <div className="flex-1 bg-black/5 dark:bg-black/30 rounded-2xl p-4 font-mono text-xs overflow-auto border border-border text-foreground">
                  <pre>{after ? JSON.stringify(after, null, 2) : "null / none"}</pre>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-card hover:bg-black/5 dark:hover:bg-white/5 border border-border text-foreground font-semibold rounded-xl text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
