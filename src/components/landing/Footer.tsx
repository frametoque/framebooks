import Link from 'next/link';
import { navigation } from '@/data/landing/content';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-[#E5E7EB] pt-16 pb-8">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2">
            <Link
              href="/"
              className="text-2xl font-black tracking-tight mb-4 inline-block hover:text-[#00C750] transition-colors"
            >
              Framebooks
            </Link>
            <p className="text-gray-500 mb-6 max-w-sm">
              The complete cloud ERP and accounting system for modern businesses in Sri Lanka.
            </p>
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
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
            <h4 className="font-bold mb-4">Product</h4>
            <ul className="space-y-3 text-sm text-gray-600">
              {navigation.map((n) => (
                <li key={n.name}>
                  <Link href={n.href} className="hover:text-[#00C750] transition-colors">
                    {n.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Legal</h4>
            <ul className="space-y-3 text-sm text-gray-600">
              <li>
                <Link href="#" className="hover:text-[#00C750] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[#00C750] transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[#E5E7EB] pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} FrameToque Digital Media. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
