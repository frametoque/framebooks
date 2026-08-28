import {
  Linkedin,
  Mail,
  Instagram,
  Youtube,
  MessageCircle,
  Facebook,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const footerLinks = {
  Company: ["About", "Work", "Contact"],
  Legal: ["Privacy", "Terms", "Cookies"],
};
const urls = [
  "https://instagram.com/frame.toque",
  "https://facebook.com/framebookss",
  "https://www.linkedin.com/company/framebookss/",
  "https://youtube.com/@FrameBookss",
  "https://tiktok.com/@frame.toque",
  "https://t.me/framebookss",
  "mailto:info@framebookss.com",
];

const TikTok = () => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className="w-5 h-5"
  >
    <title>TikTok</title>
    <path
      d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
      fill="currentColor"
    />
  </svg>
);

const Telegram = () => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className="w-5 h-5"
  >
    <title>Telegram</title>
    <path
      d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
      fill="currentColor"
    />
  </svg>
);

export default function Footer() {
  return (
    <footer className="bg-black backdrop-blur-xl border-t border-border relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-8 gap-6 sm:gap-8 lg:gap-12 mb-10 sm:mb-12">
          <div className="col-span-1 sm:col-span-4 lg:col-span-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start space-x-2 mb-3 sm:mb-4">
              <Image
                src="/logos/ft/name-logo.png"
                alt="FrameBookss"
                width={200}
                height={40}
                className="w-32 h-auto sm:w-48"
              />
            </div>
            <p className="text-gray-400 mb-4 sm:mb-6 max-w-sm mx-auto sm:mx-0 text-sm sm:text-base">
              <Link
                href="https://share.google/8O9paXxs7VBKoAZlR"
                aria-label="Google Maps"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-400 transition inline-block py-2"
              >
                Piliyandala, Sri Lanka{" "}
              </Link>
              <br />
              <span className="whitespace-nowrap">
                <Link
                  href="tel:+94702771361"
                  aria-label="Telephone"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-400 transition inline-block py-2"
                >
                  +94 70 277 1361
                </Link>
                <span className="mx-2 text-gray-600">|</span>
                <Link
                  href="tel:+94778609356"
                  aria-label="Telephone"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-400 transition inline-block py-2"
                >
                  +94 77 860 9356
                </Link>
              </span>
            </p>
            <div className="flex justify-center space-x-2">
              {[
                Instagram,
                Facebook,
                Linkedin,
                Youtube,
                TikTok,
                Telegram,
                Mail,
              ].map((Icon, idx) => (
                <Link
                  aria-label="Connect With Us"
                  key={idx}
                  href={urls[idx]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-card backdrop-blur-md rounded-md hover:bg-white/20 transition duration-300 flex items-center justify-center"
                >
                  <Icon className="w-5 h-5 text-foreground" />
                </Link>
              ))}
            </div>
          </div>

          <div className="sm:col-span-4 lg:col-span-6">
            <div className="grid grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-12">
              {Object.entries(footerLinks).map(([category, links]) => (
                <div key={category}>
                  <h3 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">
                    {category}
                  </h3>
                  <ul className="space-y-2 sm:space-y-3">
                    {links.map((link) => (
                      <li key={link}>
                        <Link
                          href={`/${link.toLowerCase()}`}
                          className="text-gray-400 hover:text-foreground transition-colors duration-200 text-xs sm:text-sm"
                        >
                          {link}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div>
                <h3 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">
                  Reg No:
                </h3>
                <p className="text-gray-300 text-xs sm:text-sm max-w-xs">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-[#3ec3ec] to-brand-400 font-semibold">
                    Your brand deserves better visuals.
                  </span>{" "}
                  We make brands look serious.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 sm:pt-8 border-t border-slate-800">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
            <p className="text-gray-400 text-xs sm:text-sm">
              © {new Date().getFullYear()} FrameBookss Digital Media. All rights
              reserved.
            </p>
            <div className="flex items-center space-x-4 sm:space-x-6 text-xs sm:text-sm">
              <Link
                href="/privacy"
                className="text-gray-400 hover:text-foreground transition-colors duration-200"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-gray-400 hover:text-foreground transition-colors duration-200"
              >
                Terms & Conditions
              </Link>
              <Link
                href="/cookies"
                className="text-gray-400 hover:text-foreground transition-colors duration-200"
              >
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
