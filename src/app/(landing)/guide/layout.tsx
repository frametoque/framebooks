"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MdSearch, 
  MdMenu, 
  MdClose, 
  MdKeyboardArrowDown, 
  MdKeyboardArrowRight,
  MdSettings,
  MdLayers,
  MdCheck
} from 'react-icons/md';
import { guideGroups } from '@/lib/guide-content';

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  
  const activeItemRef = useRef<HTMLLIElement | null>(null);

  // Auto-scroll active item into view on page load or navigation
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [pathname]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const searchResults = searchQuery.length > 2 
    ? guideGroups.flatMap(g => g.articles).filter(a => 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        a.intro.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const filteredGroups = selectedCategory === 'all' 
    ? guideGroups 
    : guideGroups.filter(g => g.id === selectedCategory);

  const SidebarContent = () => (
    <div className="py-6 px-4">
      {/* Search Input */}
      <div className="mb-4 relative">
        <MdSearch className="absolute left-3.5 top-3 text-gray-400 w-4 h-4" />
        <input 
          type="text" 
          placeholder="Search the guide... (/)" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-100 border border-transparent rounded-xl py-2 pl-9 pr-4 text-xs font-medium focus:bg-white focus:border-[#00E35B] focus:ring-2 focus:ring-[#00E35B]/20 outline-none transition-all" 
        />
        <AnimatePresence>
          {searchQuery && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 10 }} 
              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 max-h-64 overflow-y-auto custom-scrollbar"
            >
              {searchResults.length > 0 ? (
                searchResults.map(res => (
                  <Link 
                    key={res.slug} 
                    href={`/guide/${res.slug}`} 
                    onClick={() => { setSearchQuery(''); setMobileMenuOpen(false); }} 
                    className="block px-3.5 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                  >
                    <p className="text-xs font-bold text-[#082830]">{res.title}</p>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{res.intro}</p>
                  </Link>
                ))
              ) : (
                <div className="p-4 text-xs text-gray-500 text-center">No results found.</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Category Quick Filter */}
      <div className="mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Quick Jump
          </span>
          {selectedCategory !== 'all' && (
            <button 
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="text-[10px] font-bold text-[#007A31] hover:underline"
            >
              View All
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-[#082830] text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200/70'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('settings-workspace')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedCategory === 'settings-workspace'
                ? 'bg-[#00E35B] text-[#082830] shadow-xs'
                : 'bg-[#E6FDF0] text-[#007A31] hover:bg-[#cbf7df]'
            }`}
          >
            <MdSettings className="w-3.5 h-3.5" />
            <span>Settings ({guideGroups.find(g => g.id === 'settings-workspace')?.articles.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('financial-reports')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              selectedCategory === 'financial-reports'
                ? 'bg-[#082830] text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200/70'
            }`}
          >
            Reports
          </button>
        </div>
      </div>

      {/* Guide Groups Navigation */}
      <nav className="space-y-6 pb-20">
        {filteredGroups.map(group => {
          const isCollapsed = Boolean(collapsedGroups[group.id]);
          return (
            <div key={group.id} className="group-wrapper">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-2 py-1 text-left text-xs font-bold text-gray-400 hover:text-gray-700 uppercase tracking-wider mb-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="truncate">{group.title}</span>
                <span className="text-gray-400">
                  {isCollapsed ? <MdKeyboardArrowRight className="w-4 h-4" /> : <MdKeyboardArrowDown className="w-4 h-4" />}
                </span>
              </button>

              {!isCollapsed && (
                <ul className="space-y-1">
                  {group.articles.map(article => {
                    const isActive = pathname === `/guide/${article.slug}` || (pathname === '/guide' && article.slug === 'welcome');
                    return (
                      <li 
                        key={article.slug} 
                        ref={isActive ? activeItemRef : null} 
                        className="relative"
                      >
                        {isActive && (
                          <motion.div 
                            layoutId="guide-active-pill" 
                            className="absolute inset-0 bg-[#E6FDF0] rounded-lg border border-[#00E35B]/30" 
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }} 
                          />
                        )}
                        <Link 
                          href={`/guide/${article.slug}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`relative flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                            isActive 
                              ? 'text-[#007A31] font-bold' 
                              : 'text-gray-600 hover:text-[#082830] hover:bg-gray-50'
                          }`}
                        >
                          <span className="truncate pr-2">{article.title}</span>
                          {article.plan && (
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                              {article.plan}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-[#082830] font-sans selection:bg-[#00E35B] selection:text-white pt-20">
      
      {/* MOBILE TOGGLE */}
      <div className="lg:hidden border-b border-[#E5E7EB] bg-[#F9FAFB] p-4 flex justify-between items-center sticky top-20 z-30">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">User Guide</span>
          <span className="text-xs text-gray-500">Navigation</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
          className="p-2 bg-white rounded-lg border border-gray-200 text-gray-700 hover:text-black"
          aria-label="Toggle Guide Navigation Menu"
        >
          {mobileMenuOpen ? <MdClose className="w-5 h-5" /> : <MdMenu className="w-5 h-5" />}
        </button>
      </div>

      <div className="container mx-auto max-w-7xl flex relative">
        
        {/* DESKTOP SIDEBAR */}
        <aside 
          data-lenis-prevent="true"
          className="hidden lg:block w-76 shrink-0 border-r border-[#E5E7EB] h-[calc(100vh-5rem)] sticky top-20 overflow-y-auto custom-scrollbar overscroll-contain bg-white z-20"
        >
          <SidebarContent />
        </aside>

        {/* MOBILE DRAWER */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setMobileMenuOpen(false)} 
                className="fixed inset-0 bg-[#082830]/40 z-40 lg:hidden backdrop-blur-sm" 
              />
              <motion.aside 
                data-lenis-prevent="true"
                initial={{ x: '-100%' }} 
                animate={{ x: 0 }} 
                exit={{ x: '-100%' }} 
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }} 
                className="fixed top-0 left-0 bottom-0 w-80 bg-white z-50 overflow-y-auto custom-scrollbar shadow-2xl lg:hidden"
              >
                <div className="p-4 flex items-center justify-between border-b border-gray-100">
                  <span className="font-bold text-sm text-[#082830]">Guide Navigation</span>
                  <button 
                    onClick={() => setMobileMenuOpen(false)} 
                    className="p-1.5 bg-gray-100 rounded-full text-gray-500 hover:text-gray-900"
                  >
                    <MdClose className="w-4 h-4" />
                  </button>
                </div>
                <SidebarContent />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 min-w-0 px-6 py-10 md:px-12 lg:py-14">
          {children}
        </main>

      </div>
    </div>
  );
}
