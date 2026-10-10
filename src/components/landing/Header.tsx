"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdMenu, MdClose } from 'react-icons/md';
import { navigation } from '@/data/landing/content';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const isHome = pathname === '/';
  // On non-home pages (e.g. /help, /guide), keep solid blurred background for readability
  const isSolid = scrolled || !isHome;

  const isAuthenticated = mounted && status === 'authenticated' && !!session;
  const actionHref = isAuthenticated ? '/user/dashboard' : '/login';
  const actionLabel = isAuthenticated ? 'Dashboard' : 'Start Free';

  return (
    <>
      {/* NAVBAR */}
      <header
        className={`fixed top-0 w-full z-50 transition-all duration-300 h-16 sm:h-20 flex items-center ${
          isSolid
            ? 'bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] shadow-xs'
            : 'bg-transparent'
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6 md:px-12 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 group">
            <span
              className="text-xl sm:text-2xl font-black tracking-tight group-hover:text-[#00C750] transition-colors"
            >
              Framebooks
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {navigation.map((n) => {
              const isActive =
                n.href === pathname ||
                (n.href === '/guide' && pathname?.startsWith('/guide'));
              return (
                <Link
                  key={n.name}
                  href={n.href}
                  className={`text-sm font-semibold transition-colors ${
                    isActive
                      ? 'text-[#00C750] font-bold'
                      : 'text-gray-600 hover:text-[#00C750]'
                  }`}
                >
                  {n.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <Link
              href={actionHref}
              className="px-5 py-2.5 bg-[#00E35B] hover:bg-[#00C750] text-[#041418] font-bold rounded-full transition-all hover:scale-105 shadow-sm"
            >
              {actionLabel}
            </Link>
          </div>

          {/* Mobile Right Controls: Fast CTA + Hamburger */}
          <div className="flex lg:hidden items-center gap-2">
            <Link
              href={actionHref}
              className="px-3.5 py-1.5 bg-[#00E35B] hover:bg-[#00C750] active:scale-95 text-[#041418] text-xs font-bold rounded-full transition-all shadow-xs"
            >
              {actionLabel}
            </Link>
            <button
              className="w-10 h-10 flex items-center justify-center rounded-xl text-[#082830] hover:bg-gray-100 active:bg-gray-200 transition-colors focus:outline-none"
              aria-label="Open menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              <MdMenu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE MENU DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="fixed inset-0 z-[60] bg-white flex flex-col overflow-y-auto"
          >
            <div className="p-5 sm:p-6 flex justify-between items-center border-b border-gray-100">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="text-xl sm:text-2xl font-black tracking-tight"
              >
                Framebooks
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center text-gray-700 transition-colors focus:outline-none"
                aria-label="Close menu"
              >
                <MdClose className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2 p-5 sm:p-6 flex-1">
              {navigation.map((n) => {
                const isActive =
                  n.href === pathname ||
                  (n.href === '/guide' && pathname?.startsWith('/guide'));
                return (
                  <Link
                    key={n.name}
                    href={n.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3.5 rounded-2xl text-lg font-bold flex items-center justify-between transition-colors ${
                      isActive
                        ? 'bg-[#E6FDF0] text-[#007A31]'
                        : 'text-[#082830] hover:bg-gray-50 active:bg-gray-100'
                    }`}
                  >
                    <span>{n.name}</span>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-[#00E35B]" />
                    )}
                  </Link>
                );
              })}
            </div>

            <div className="p-5 sm:p-6 mt-auto border-t border-gray-100 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
              <Link
                href={actionHref}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3.5 bg-[#00E35B] hover:bg-[#00C750] active:scale-98 text-[#041418] text-center font-bold rounded-xl shadow-md transition-all block text-base"
              >
                {actionLabel}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
