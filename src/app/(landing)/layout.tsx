import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import CookieBanner from '@/components/landing/CookieBanner';
import SmoothScroll from '@/components/landing/SmoothScroll';

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SmoothScroll>
      <div className="min-h-screen bg-[#F9FAFB] text-[#082830] font-sans selection:bg-[#00E35B] selection:text-white flex flex-col justify-between">
        <Header />
        <div className="flex-1 w-full flex flex-col">
          {children}
        </div>
        <Footer />
        <CookieBanner />
      </div>
    </SmoothScroll>
  );
}
