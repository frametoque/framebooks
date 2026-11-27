export const metadata = {
  title: "Login",
  description: "Log in to your Framebooks account to manage your Cloud ERP, financial ledgers, and retail POS counters securely.",
  openGraph: {
    title: "Login",
    description: "Log in to your Framebooks account to manage your Cloud ERP, financial ledgers, and retail POS counters securely.",
    url: "https://books.frametoque.com/login", 
    siteName: "Framebooks",
    images: [
      {
        url: "https://books.frametoque.com/og-image.png",
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
    description: "Log in to your Framebooks account to manage your Cloud ERP, financial ledgers, and retail POS counters securely.",
    images: ["https://books.frametoque.com/og-image.png"],
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