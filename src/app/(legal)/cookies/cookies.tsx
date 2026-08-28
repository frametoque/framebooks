"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import Footer from "@/components/Footer";

export default function Cookies() {    const [scrolled, setScrolled] = useState(false);
  
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
        <Navbar scrolled={scrolled} />
        <div className="h-20" />
        <div className="min-h-screen bg-gray-950 text-foreground px-6 sm:px-10 lg:px-16 py-16">
          <h1 className="text-4xl sm:text-5xl font-bold mb-8 text-center">Cookie Policy</h1>

          <section className="space-y-6 max-w-4xl mx-auto">
            <div>
              <h2 className="text-2xl font-semibold mb-2">1. What Are Cookies</h2>
              <p className="text-gray-300 leading-relaxed">
                Cookies are small text files stored on your device when you visit a website. They help enhance your browsing experience and allow websites to remember your preferences.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-2">2. How We Use Cookies</h2>
              <p className="text-gray-300 leading-relaxed">
                FrameBookss uses cookies to:
              </p>
              <ul className="list-disc list-inside text-gray-300 leading-relaxed">
                <li>Remember your preferences and settings</li>
                <li>Analyze website traffic and performance</li>
                <li>Improve user experience</li>
                <li>Support functional features, such as project submissions</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-2">3. Third-Party Cookies</h2>
              <p className="text-gray-300 leading-relaxed">
                We may use third-party services, such as analytics providers, which may place cookies on your device. These cookies help us understand website usage and improve our services.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-2">4. Managing Cookies</h2>
              <p className="text-gray-300 leading-relaxed">
                You can control or delete cookies through your browser settings. However, some features of our website may not work correctly if cookies are disabled.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-2">5. Updates to This Policy</h2>
              <p className="text-gray-300 leading-relaxed">
                We may update this Cookie Policy from time to time. Continued use of FrameBookss indicates your acceptance of any changes.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-2">6. Contact</h2>
              <p className="text-gray-300 leading-relaxed">
                For questions about this Cookie Policy, please <Link href="/contact" className="text-brand-600 hover:text-brand-500 font-semibold">contact us</Link>.
              </p>
            </div>
          </section>
        </div>
        <Footer />
      </main >
    </>
  );
}
