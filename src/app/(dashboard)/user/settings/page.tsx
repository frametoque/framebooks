import { Loader } from "@/components/ui/Loader";
export const metadata = {
  title: "Settings",
  description: "Manage your account settings, profile details, and payment methods all in one place.",
  openGraph: {
    title: "Settings | FrameBookss",
    description: "Manage your account settings, profile details, and payment methods all in one place.",
    url: "https://framebookss.com/dashboard/settings", 
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
};

import React from 'react'
import MainPage from './MainPage'

import { Suspense } from 'react';

function page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader /></div>}>
      <MainPage/>
    </Suspense>
  )
}

export default page