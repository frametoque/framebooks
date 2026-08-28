export const metadata = {
  title: "Terms & Conditions",
  description:
    "Read the terms and conditions for using FrameBookss's web development, graphic design, and video editing services.",
    openGraph: {
    title: "Terms & Conditions |  | FrameBookss Digital Media",
    description: "Read the terms and conditions for using FrameBookss's web development, graphic design, and video editing services.",
    url: "https://framebookss.com/terms", 
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
    title: "Terms & Conditions | FrameBookss Digital Media",
    description: "Read the terms and conditions for using FrameBookss's web development, graphic design, and video editing services.",
    images: ["https://framebookss.com/og-image.png"],
  },
};

import TermsContent from "@/app/(legal)/terms/terms";


export default function Terms() {
  return (
    <>
    <main  className="min-h-screen bg-slate-950 text-foreground overflow-hidden">
    <TermsContent />
  </main >
  </>
  );
}
