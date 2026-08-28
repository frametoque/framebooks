import Link from "next/link";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";

export const metadata = {
  title: "403 Access Denied | FrameBookss",
  description: "Oops! The page you're looking for doesn't exist. Return home to explore FrameBookss.",
  robots: "noindex, follow", 
};

import { CartProvider } from "../../../context/CartContext";

export default function Forbidden() {
  return (
    <CartProvider>
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-foreground">
        <Navbar scrolled={false} />

      <main className="flex flex-col items-center justify-center flex-1">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center shadow-lg w-11/12 sm:w-96 mt-12">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-b from-brand-400 to-brand-500 bg-clip-text text-transparent">403</h1>
          <p className="text-lg mb-6">Oops! You don’t have permission to access this page.</p>
          <Link
            href="/"
            className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-3xl font-medium transition-colors"
          >
            Go Home
          </Link>
        </div>
      </main>

      <Footer />
    </div>
    </CartProvider>
  );
}
