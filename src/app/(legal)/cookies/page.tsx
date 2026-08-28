export const metadata = {
  title: "Cookie Policy",
  description:
    "Read the cookie policy for FrameBookss, explaining how we use cookies and similar technologies on our website.",
    openGraph: {
    title: "Cookie Policy | FrameBookss Digital Media",
    description: "Read the cookie policy for FrameBookss, explaining how we use cookies and similar technologies on our website.",
    url: "https://framebookss.com/cookies", 
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
    title: "Cookie Policy | FrameBookss Digital Media",
    description: "Read the cookie policy for FrameBookss, explaining how we use cookies and similar technologies on our website.",
    images: ["https://framebookss.com/og-image.png"],
  },
};

import CookiesContent from "@/app/(legal)/cookies/cookies";

export default function Cookies() { 

  return (
    <>
      <main  className="min-h-screen bg-slate-950 text-foreground overflow-hidden">
       
        <CookiesContent />
      </main >
    </>
  );
}
