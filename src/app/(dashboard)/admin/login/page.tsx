import React, { Suspense } from "react";
import { Metadata } from "next";
import AdminLoginClient from "./AdminLoginClient";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Admin Portal Sign In",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {

  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-[#F9FAFB] dark:bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-[#00E35B]" />
        </div>
      }
    >
      <AdminLoginClient />
    </Suspense>
  );
}
