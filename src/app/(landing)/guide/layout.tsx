"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MdSearch, MdMenu, MdClose } from 'react-icons/md';
import { guideGroups } from '@/lib/guide-content';

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const searchResults = searchQuery.length > 2 
    ? guideGroups.flatMap(g => g.articles).filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.intro.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const SidebarContent = () => (
    <div className="py-8">
      <div className="px-6 mb-8 relative">
        <MdSearch className="absolute left-9 top-3 text-gray-400" />
        <input 
          type="text" 
          placeholder="Search the guide... (/)" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-100 border-transparent rounded-full py-2.5 pl-10 pr-4 text-sm focus:bg-white focus:border-[#00E35B] focus:ring-2 focus:ring-[#00E35B]/20 outline-none transition-all" 
        />
        <AnimatePresence>
          {searchQuery && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-6 right-6 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 max-h-64 overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map(res => (
                  <Link key={res.slug} href={`/guide/${res.slug}`} onClick={() => { setSearchQuery(''); setMobileMenuOpen(false); }} className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                    <p className="text-sm font-bold text-[#082830]">{res.title}</p>
                    <p className="text-xs text-gray-500 truncate">{res.intro}</p>
                  </Link>
                ))
              ) : (
                <div className="p-4 text-sm text-gray-500 text-center">No results found.</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="px-4 space-y-8 pb-16">
        {guideGroups.map(group => (
          <div key={group.id}>
            <h4 className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{group.title}</h4>
            <ul className="space-y-1">
              {group.articles.map(article => {
                const isActive = pathname === `/guide/${article.slug}` || (pathname === '/guide' && article.slug === 'welcome');
                return (
                  <li key={article.slug} className="relative">
                    {isActive && (
                      <motion.div layoutId="guide-active-pill" className="absolute inset-0 bg-[#E6FDF0] rounded-lg" transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
                    )}
                    <Link 
                      href={`/guide/${article.slug}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`relative block px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isActive ? 'text-[#007A31]' : 'text-gray-600 hover:text-[#082830] hover:bg-gray-50'}`}
                    >
                      {article.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-[#082830] font-sans selection:bg-[#00E35B] selection:text-white pt-20">
      
      {/* MOBILE TOGGLE */}
      <div className="lg:hidden border-b border-[#E5E7EB] bg-[#F9FAFB] p-4 flex justify-between items-center sticky top-20 z-30">
        <span className="font-bold">Guide Menu</span>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 bg-white rounded-lg border border-gray-200">
          {mobileMenuOpen ? <MdClose /> : <MdMenu />}
        </button>
      </div>

      <div className="container mx-auto max-w-7xl flex relative">
        
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden lg:block w-72 shrink-0 border-r border-[#E5E7EB] h-[calc(100vh-5rem)] sticky top-20 overflow-y-auto custom-scrollbar">
          <SidebarContent />
        </aside>

        {/* MOBILE DRAWER */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-[#082830]/40 z-40 lg:hidden backdrop-blur-sm" />
              <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', bounce: 0, duration: 0.4 }} className="fixed top-0 left-0 bottom-0 w-80 bg-white z-50 overflow-y-auto shadow-2xl lg:hidden">
                <div className="p-4 flex justify-end">
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-500"><MdClose /></button>
                </div>
                <SidebarContent />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 min-w-0 px-6 py-12 md:px-12 lg:py-16">
          {children}
        </main>

      </div>
    </div>
  );
}
