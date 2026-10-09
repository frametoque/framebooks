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
        className={`fixed top-0 w-full z-50 transition-all duration-300 h-20 flex items-center ${
          isSolid
            ? 'bg-white/90 backdrop-blur-md border-b border-[#E5E7EB] shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="container mx-auto px-6 md:px-12 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 group">
            <span
              className="text-2xl font-black tracking-tight group-hover:text-[#00C750] transition-colors"
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

          <div className="hidden lg:flex items-center gap-4">
            <Link
              href={actionHref}
              className="px-5 py-2.5 bg-[#00E35B] hover:bg-[#00C750] text-[#041418] font-bold rounded-full transition-all hover:scale-105 shadow-sm"
            >
              {actionLabel}
            </Link>
          </div>

          <button
            className="lg:hidden text-2xl text-[#082830] focus:outline-none"
            aria-label="Open menu"
            onClick={() => setMobileMenuOpen(true)}
          >
            <MdMenu />
          </button>
        </div>
      </header>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[60] bg-white p-6 flex flex-col"
          >
            <div className="flex justify-between items-center mb-8">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="text-2xl font-black tracking-tight"
              >
                Framebooks
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-2xl text-gray-500 hover:text-black"
                aria-label="Close menu"
              >
                <MdClose />
              </button>
            </div>
            <div className="flex flex-col gap-6 flex-1">
              {navigation.map((n) => {
                const isActive =
                  n.href === pathname ||
                  (n.href === '/guide' && pathname?.startsWith('/guide'));
                return (
                  <Link
                    key={n.name}
                    href={n.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`text-xl font-semibold border-b border-gray-100 pb-2 transition-colors ${
                      isActive ? 'text-[#00C750]' : 'text-[#082830]'
                    }`}
                  >
                    {n.name}
                  </Link>
                );
              })}
            </div>
            <div className="flex flex-col gap-3 mt-auto pb-8">
              <Link
                href={actionHref}
                onClick={() => setMobileMenuOpen(false)}
                className="px-5 py-4 bg-[#00E35B] hover:bg-[#00C750] text-[#041418] text-center font-bold rounded-full shadow-md transition-colors"
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
