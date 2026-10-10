import Link from 'next/link';
import { navigation } from '@/data/landing/content';

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
            <p className="text-gray-500 mb-5 max-w-sm text-sm leading-relaxed">
              The complete cloud ERP and accounting system for modern businesses in Sri Lanka.
            </p>
            <p className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider">
              A product of{' '}
              <a
                href="https://frametoque.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00C750] hover:underline"
              >
                FrameToque Digital Media
              </a>
            </p>
          </div>
          <div>
            <h4 className="font-bold text-sm sm:text-base mb-3 sm:mb-4 text-[#082830]">Product</h4>
            <ul className="space-y-2.5 sm:space-y-3 text-sm text-gray-600">
              {navigation.map((n) => (
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
              <li>
                <Link href="#" className="inline-block py-0.5 hover:text-[#00C750] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="inline-block py-0.5 hover:text-[#00C750] transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[#E5E7EB] pt-6 sm:pt-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs sm:text-sm text-gray-500 text-center sm:text-left">
          <p>© {new Date().getFullYear()} FrameToque Digital Media. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
