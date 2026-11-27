import Link from 'next/link';
import { footerProductLinks, footerLegalLinks } from '@/data/landing/content';
import { FaFacebook, FaInstagram, FaTiktok, FaLinkedin } from 'react-icons/fa6';
import { MdPhone, MdEmail } from 'react-icons/md';

const socialLinks = [
  { name: 'Facebook', href: 'https://facebook.com/framebooks', icon: FaFacebook },
  { name: 'Instagram', href: 'https://instagram.com/framebooks', icon: FaInstagram },
  { name: 'TikTok', href: 'https://tiktok.com/@framebooks', icon: FaTiktok },
  { name: 'LinkedIn', href: 'https://linkedin.com/company/framebooks', icon: FaLinkedin },
];

export default function Footer() {
  return (
    <footer className="bg-white border-t border-[#E5E7EB] pt-12 sm:pt-16 pb-8">
      <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-12 sm:mb-16">
          <div className="sm:col-span-2">
            <Link
              href="/"
              className="text-xl sm:text-2xl font-black tracking-tight mb-3 inline-block hover:text-[#00C750] transition-colors"
            >
              Framebooks
            </Link>
            <p className="text-gray-500 mb-4 max-w-sm text-sm leading-relaxed">
              The complete cloud ERP, accounting, and retail Point of Sale (POS) system for modern businesses in Sri Lanka.
            </p>
            <div className="space-y-2 text-xs sm:text-sm text-gray-600 mb-5">
              <a
                href="tel:+94775536129"
                className="flex items-center gap-2 text-gray-600 hover:text-[#00C750] transition-colors w-fit"
              >
                <MdPhone className="w-4 h-4 text-[#00C750] shrink-0" />
                <span className="font-semibold">+94 77 553 6129</span>
              </a>
              <a
                href="mailto:framebooks@frametoque.com"
                className="flex items-center gap-2 text-gray-600 hover:text-[#00C750] transition-colors w-fit"
              >
                <MdEmail className="w-4 h-4 text-[#00C750] shrink-0" />
                <span className="font-semibold">framebooks@frametoque.com</span>
              </a>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider">
              A product of{' '}
              <a
                href="https://frametoque.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00C750] hover:underline"
              >
                Frametoque Digital
              </a>
            </p>
          </div>
          <div>
            <h4 className="font-bold text-sm sm:text-base mb-3 sm:mb-4 text-[#082830]">Product</h4>
            <ul className="space-y-2.5 sm:space-y-3 text-sm text-gray-600">
              {footerProductLinks.map((n) => (
                <li key={n.name}>
                  <Link href={n.href} className="inline-block py-0.5 hover:text-[#00C750] transition-colors">
                    {n.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm sm:text-base mb-3 sm:mb-4 text-[#082830]">Legal</h4>
            <ul className="space-y-2.5 sm:space-y-3 text-sm text-gray-600">
              {footerLegalLinks.map((item) => (
                <li key={item.name}>
                  <Link href={item.href} className="inline-block py-0.5 hover:text-[#00C750] transition-colors">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-[#E5E7EB] pt-6 sm:pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs sm:text-sm text-gray-500 text-center sm:text-left">
          <p>© {new Date().getFullYear()} Frametoque Digital Productions. All rights reserved.</p>
          <div className="flex items-center gap-4">
            {socialLinks.map((item) => (
              <a
                key={item.name}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.name}
                className="text-gray-400 hover:text-[#00C750] transition-colors"
              >
                <item.icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
