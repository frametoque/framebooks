"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CookieBanner() {
  const [cookiesAccepted, setCookiesAccepted] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('fb_cookies');
      if (stored === null) setCookiesAccepted(false);
    }
  }, []);

  const acceptCookies = (all: boolean) => {
    localStorage.setItem('fb_cookies', all ? 'all' : 'necessary');
    setCookiesAccepted(true);
  };

  return (
    <AnimatePresence>
      {!cookiesAccepted && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm bg-white border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 shadow-2xl z-50"
        >
          <p className="text-xs sm:text-sm text-gray-600 mb-3.5 sm:mb-4 leading-relaxed">
            We use cookies to improve your experience. Select your preference.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            <button
              onClick={() => acceptCookies(false)}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-[#E5E7EB] text-xs sm:text-sm font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors text-center"
            >
              Only necessary
            </button>
            <button
              onClick={() => acceptCookies(true)}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-[#082830] text-white text-xs sm:text-sm font-semibold hover:bg-black active:scale-[0.98] transition-all text-center"
            >
              Accept all
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
