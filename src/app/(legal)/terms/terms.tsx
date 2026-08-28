"use client";
import { useEffect, useState} from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import Footer from "@/components/Footer";

export default function Terms() {

    const [scrolled, setScrolled] = useState(false);
    
      useEffect(() => {
        function handleScroll() {
          setScrolled(window.scrollY > 50);
        }
    
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
      }, []);
      
  return (
    <>
    <main  className="min-h-screen bg-gray-950 text-foreground overflow-hidden">
<Navbar scrolled={false} />
<div className="h-20" />
    <div className="min-h-screen bg-gray-950 text-foreground px-6 sm:px-10 lg:px-16 py-16">
      <h1 className="text-4xl sm:text-5xl font-bold mb-8 text-center">Terms & Conditions</h1>
      
      <section className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h2 className="text-2xl font-semibold mb-2">1. Acceptance of Terms</h2>
          <p className="text-gray-300 leading-relaxed">
            By using FrameBookss, you agree to comply with and be bound by these Terms & Conditions. If you do not agree, please do not use our services.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">2. Use of Services</h2>
          <p className="text-gray-300 leading-relaxed">
            You agree to use FrameBookss only for lawful purposes and in accordance with all applicable laws. Any unauthorized use may result in termination of access.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">3. User Content</h2>
          <p className="text-gray-300 leading-relaxed">
            Users are responsible for all content they upload, post, or share. FrameBookss reserves the right to remove content that violates our guidelines or applicable law.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">4. Intellectual Property</h2>
          <p className="text-gray-300 leading-relaxed">
            All content on FrameBookss, including images, videos, and text, is protected by copyright. You may not copy or distribute content without proper authorization.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">5. Limitation of Liability</h2>
          <p className="text-gray-300 leading-relaxed">
            FrameBookss is not liable for any direct, indirect, or consequential damages arising from your use of the service.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">6. Changes to Terms</h2>
          <p className="text-gray-300 leading-relaxed">
            We may update these Terms at any time. Continued use of FrameBookss signifies your acceptance of the new terms.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">7. Contact</h2>
          <p className="text-gray-300 leading-relaxed">
            For questions about these Terms, please <Link href="/contact" className="text-brand-600 hover:text-brand-500 font-semibold">contact us</Link>.
          </p>
        </div>
      </section>
    </div>
    <Footer />
  </main >
  </>
  );
}
