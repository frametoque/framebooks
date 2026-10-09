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
          className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:max-w-sm bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-2xl z-50"
        >
          <p className="text-sm text-gray-600 mb-4">
            We use cookies to improve your experience. Select your preference.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => acceptCookies(false)}
              className="flex-1 py-2 px-4 rounded-xl border border-[#E5E7EB] text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Only necessary
            </button>
            <button
              onClick={() => acceptCookies(true)}
              className="flex-1 py-2 px-4 rounded-xl bg-[#082830] text-white text-sm font-semibold hover:bg-black transition-colors"
            >
              Accept all
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
