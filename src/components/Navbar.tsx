"use client";
import { useEffect, useState } from "react";
import { Menu, X, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useSession, signOut } from 'next-auth/react';
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "@/context/CartContext";

const protectImage = (e) => e.preventDefault();

export default function Navbar({ scrolled }: { scrolled: boolean }) {
  const [mobileMenuIsOpen, setMobileMenuIsOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isSignedIn = status === "authenticated";
  const isLoaded = status !== "loading";
  const { cartCount } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const links = [
    { href: "/projects", label: "Work" },
    { href: "/services", label: "Services" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 flex items-center justify-between px-6 lg:px-16 py-3 ${
        scrolled ? "bg-black/60 backdrop-blur-md shadow-2xl" : "bg-transparent"
      }`}
    >
      <div className="flex items-center gap-2 group cursor-pointer z-50 w-[180px] sm:w-[220px]">
        <Link href="/">
          <Image
            src="/logos/ft/name-logo.png"
            alt="FrameBookss"
            width={200}
            height={40}
            onContextMenu={protectImage}
            onDragStart={protectImage}
            loading="eager"
            priority={true}
            className="h-auto transition-all duration-300 w-28 sm:w-36"
          />
        </Link>
      </div>

      <div className="hidden md:flex flex-1 items-center justify-center gap-2">
        {links.map((link) => {
          const isActive =
            link.href === "/services"
              ? pathname === "/services" || pathname.startsWith("/services/")
              : pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative px-5 py-1.5 text-sm font-medium transition-all duration-300 rounded-full group overflow-hidden ${
                isActive
                  ? "text-foreground bg-white/10 shadow-inner drop-shadow-md"
                  : "text-foreground drop-shadow-md hover:bg-black/10 dark:hover:bg-white/10"
              }`}
            >
              <span className="relative z-10">{link.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Desktop CTA */}
      <div className="hidden md:flex items-center justify-end gap-4 w-[180px] sm:w-[220px]">
        <Link
          href="/cart"
          className="relative p-2 text-foreground hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
          title="Shopping Cart"
        >
          <ShoppingCart className="w-5 h-5" />
          {mounted && cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-brand-500 text-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
              {cartCount}
            </span>
          )}
        </Link>
        {!isLoaded ? null : isSignedIn ? (
          <Link
            href="/user/dashboard"
            className="group relative flex items-center justify-center bg-blue-600 text-foreground hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all duration-300 rounded-full px-6 py-2 text-sm font-semibold shadow-lg shadow-blue-600/20"
          >
            Dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="group relative flex items-center justify-center bg-white text-black hover:bg-gray-100 hover:scale-105 active:scale-95 transition-all duration-300 rounded-full px-6 py-2 text-sm font-semibold shadow-lg"
          >
            Get Started
          </Link>
        )}
      </div>

      {/* Mobile Cart & menu button */}
      <div className="flex items-center gap-2 md:hidden z-50">
        <Link
          href="/cart"
          className="relative p-2 text-foreground hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-all duration-300"
          title="Shopping Cart"
        >
          <ShoppingCart className="w-6 h-6" />
          {mounted && cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-brand-500 text-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
              {cartCount}
            </span>
          )}
        </Link>
        <button
          aria-label="Toggle Menu"
          className="p-2 text-foreground drop-shadow-md transition-colors rounded-full hover:bg-black/10 dark:hover:bg-white/10"
          onClick={() => setMobileMenuIsOpen((prev) => !prev)}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={mobileMenuIsOpen ? "close" : "open"}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="block"
            >
              {mobileMenuIsOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuIsOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className={`absolute top-full left-0 right-0 border-t border-black/20 dark:border-white/20 md:hidden shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden ${
              scrolled
                ? "bg-black/90 backdrop-blur-3xl shadow-2xl"
                : "bg-black/80 backdrop-blur-3xl shadow-2xl"
            }`}
          >
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.25, delay: 0.05, ease: "easeOut" }}
              className="flex flex-col space-y-2 pt-4 pb-6 px-6"
            >
              {links.map((link, i) => {
                const isActive =
                  link.href === "/services"
                    ? pathname === "/services" ||
                      pathname.startsWith("/services/")
                    : pathname === link.href ||
                      pathname.startsWith(`${link.href}/`);

                return (
                  <motion.div
                    key={link.href}
                    initial={{ x: -16, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -16, opacity: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: 0.07 + i * 0.05,
                      ease: "easeOut",
                    }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setMobileMenuIsOpen(false)}
                      className={`block px-4 py-3 rounded-xl text-base transition-all duration-300 ${
                        isActive
                          ? "text-foreground bg-white/10 font-medium"
                          : "text-foreground hover:bg-black/10 dark:hover:bg-white/10"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                );
              })}

              {/* Mobile CTA */}
              <motion.div
                className="pt-4 px-2"
                initial={{ x: -16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -16, opacity: 0 }}
                transition={{
                  duration: 0.2,
                  delay: 0.07 + links.length * 0.05,
                  ease: "easeOut",
                }}
              >
                {isLoaded &&
                  (isSignedIn ? (
                    <Link
                      href="/user/dashboard"
                      onClick={() => setMobileMenuIsOpen(false)}
                      className="flex items-center justify-center w-full bg-blue-600 text-foreground rounded-xl px-6 py-3.5 text-base font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-md shadow-blue-600/20"
                    >
                      Dashboard
                    </Link>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuIsOpen(false)}
                      className="flex items-center justify-center w-full bg-white text-black rounded-xl px-6 py-3.5 text-base font-semibold hover:bg-gray-200 active:scale-[0.98] transition-all shadow-md"
                    >
                      Get Started
                    </Link>
                  ))}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}