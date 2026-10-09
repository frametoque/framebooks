export const metadata = {
  title: "Login",
  description: "Log in to your Framebooks account to manage your dashboard, track services, and access your projects securely.",
  openGraph: {
    title: "Login",
    description: "Log in to your Framebooks account to manage your dashboard, track services, and access your projects securely.",
    url: "https://framebooks.com/login", 
    siteName: "Framebooks",
    images: [
      {
        url: "https://framebooks.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Framebooks",
      },
    ],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Login",
    description: "Log in to your Framebooks account to manage your dashboard, track services, and access your projects securely.",
    images: ["https://framebooks.com/og-image.png"],
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