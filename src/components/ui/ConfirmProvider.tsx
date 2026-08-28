"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

type ConfirmOptions = {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type ConfirmContextType = {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
};

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [options, setOptions] = useState<ConfirmOptions>({});
  const [resolveFn, setResolveFn] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (msg: string, opts?: ConfirmOptions) => {
      setMessage(msg);
      setOptions(opts || {});
      setIsOpen(true);
      return new Promise<boolean>((resolve) => {
        setResolveFn(() => resolve);
      });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    if (resolveFn) resolveFn(true);
  }, [resolveFn]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    if (resolveFn) resolveFn(false);
  }, [resolveFn]);

  const isDanger = options.danger !== false; // default to danger style

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-0">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancel}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isDanger ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'}`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="pt-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">
                      {options.title || "Confirm Action"}
                    </h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {message}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col-reverse gap-2 bg-gray-50 p-4 sm:flex-row sm:justify-end dark:bg-zinc-800/50">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex w-full justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto sm:py-2 dark:bg-zinc-800 dark:text-gray-100 dark:ring-zinc-600 dark:hover:bg-zinc-700 transition-colors"
                >
                  {options.cancelText || "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={`inline-flex w-full justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm sm:w-auto sm:py-2 transition-colors ${
                    isDanger 
                      ? 'bg-red-600 hover:bg-red-500 dark:bg-red-600 dark:hover:bg-red-500' 
                      : 'bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500'
                  }`}
                >
                  {options.confirmText || "Confirm"}
                </button>
              </div>
              
              <button
                onClick={handleCancel}
                className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-zinc-800 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};
