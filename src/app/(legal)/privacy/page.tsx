export const metadata = {
  title: "Privacy Policy",
  description:
    "Read the privacy policy for FrameBookss, detailing how we collect and handle user data when submitting projects or using our services.",
    openGraph: {
    title: "Privacy Policy | FrameBookss Digital Media",
    description: "Read the privacy policy for FrameBookss, detailing how we collect and handle user data when submitting projects or using our services.",
    url: "https://framebookss.com/privacy", 
    siteName: "FrameBookss",
    images: [
      {
        url: "https://framebookss.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "FrameBookss",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | FrameBookss Digital Media",
    description: "Read the privacy policy for FrameBookss, detailing how we collect and handle user data when submitting projects or using our services.",
    images: ["https://framebookss.com/og-image.png"],
  },
};

import PrivacyContent from "@/app/(legal)/privacy/privacy";


export default function Privacy() {
  return (
    <>
      <main  className="min-h-screen bg-slate-950 text-foreground overflow-hidden">
        <PrivacyContent />
      </main >
    </>
  );
}
