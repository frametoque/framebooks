// src/components/admin/ConfirmModal.tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Loader2 } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  typeToConfirmText?: string;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  typeToConfirmText,
}: ConfirmModalProps) {
  const [typedInput, setTypedInput] = useState("");
  const [loading, setLoading] = useState(false);

  const isConfirmDisabled = typeToConfirmText
    ? typedInput.trim().toLowerCase() !== typeToConfirmText.trim().toLowerCase()
    : false;

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
      setTypedInput("");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative"
          >
            <button
              onClick={onClose}
              disabled={loading}
              className="absolute top-5 right-5 p-1.5 rounded-xl text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  isDestructive
                    ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                }`}
              >
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground">{title}</h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">
              {description}
            </p>

            {typeToConfirmText && (
              <div className="mb-5 p-3.5 bg-black/[0.03] dark:bg-black/20 rounded-2xl border border-border">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  To confirm, type <span className="font-mono font-bold text-foreground">{typeToConfirmText}</span> below:
                </label>
                <input
                  type="text"
                  value={typedInput}
                  onChange={(e) => setTypedInput(e.target.value)}
                  placeholder={typeToConfirmText}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground outline-none focus:border-brand-500 font-mono"
                  autoFocus
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-border bg-card hover:bg-black/5 dark:hover:bg-white/5 text-foreground transition-colors disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirmDisabled || loading}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDestructive
                    ? "bg-red-600 hover:bg-red-500 text-white shadow-red-500/20"
                    : "bg-brand-500 hover:bg-brand-400 text-brand-900 shadow-brand-500/20"
                }`}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
