export const metadata = {
  title: "Login | FrameBookss",
  description: "Log in to your FrameBookss account to manage your dashboard, track services, and access your projects securely.",
  openGraph: {
    title: "Login | FrameBookss Digital Media",
    description: "Log in to your FrameBookss account to manage your dashboard, track services, and access your projects securely.",
    url: "https://framebookss.com/login", 
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
    title: "Login | FrameBookss Digital Media",
    description: "Explore our range of services...",
    images: ["https://framebookss.com/og-image.png"],
  },
};

import React from 'react'
import Login from "./MainPage"

function page() {
  return (
    <>
    
     <Login />
        
    </>
   
  )
}

export default page