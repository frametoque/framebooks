import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "404 Not Found",
  description: "Oops! The page you're looking for doesn't exist.",
  robots: "noindex, follow",
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#071317] text-white px-6">
      <div className="flex flex-col items-center text-center max-w-md w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-10 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-[#00E35B]/10 border border-[#00E35B]/20 flex items-center justify-center mb-6">
          <span className="text-2xl font-black text-[#00E35B]">404</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link
            href="/user/dashboard"
            className="flex-1 px-5 py-3 bg-[#00E35B] hover:bg-[#00C750] text-[#041418] rounded-xl font-bold text-sm transition-all shadow-md text-center"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="flex-1 px-5 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-semibold text-sm transition-all border border-white/10 text-center"
          >
            Home
          </Link>
        </div>
      </div>
      <p className="mt-8 text-gray-500 text-xs">Framebooks</p>
    </div>
  );
}
