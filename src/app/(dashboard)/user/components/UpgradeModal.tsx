"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { MdClose } from 'react-icons/md';

export function UpgradeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setMessage(customEvent.detail || 'You have reached the limit for your current plan.');
      setIsOpen(true);
    };

    window.addEventListener('upgrade-modal:open', handleOpen);
    return () => window.removeEventListener('upgrade-modal:open', handleOpen);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
      <div 
        className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col relative"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={() => setIsOpen(false)} 
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <MdClose className="w-5 h-5" />
        </button>

        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-brand-500/10 text-brand-500 rounded-2xl flex items-center justify-center mb-6 border border-brand-500/20 shadow-xl shadow-brand-500/10">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Upgrade Required</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed text-sm">
            {message.replace('LIMIT_EXCEEDED: ', '')}
          </p>
          <div className="flex flex-col gap-3 w-full">
            <Link 
              href="/user/settings" 
              onClick={() => setIsOpen(false)}
              className="w-full px-6 py-3.5 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-xl font-bold transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2"
            >
              View Subscription Plans
            </Link>
            <button 
              onClick={() => setIsOpen(false)}
              className="w-full px-6 py-3 bg-transparent border border-border hover:bg-card text-gray-300 rounded-xl font-medium transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
