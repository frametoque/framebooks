"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Sparkles } from "lucide-react";
import { MdShoppingCart } from "react-icons/md";
import { useSession, signOut } from 'next-auth/react';


import ProfileProgress from "./ProfileProgress";
const RecentProjectsWidget = () => null;

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardHome() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isSignedIn = status === "authenticated";
  const isLoaded = status !== "loading";
  const user = session?.user;

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/login"); 
    }
  }, [isLoaded, isSignedIn, router]);

  const quickActions = [
    {
      href: "/user/invoices",
      icon: MdShoppingCart,
      label: "View Invoices",
      className:
        "flex items-center gap-2 px-6 py-3 bg-white/10 border border-black/20 dark:border-white/20 text-foreground rounded-3xl font-semibold hover:opacity-90 transition-opacity",
    },
    {
      href: "/user/clients",
      icon: MessageCircle,
      label: "Manage Clients",
      className:
        "flex items-center gap-2 px-6 py-3 bg-transparent border border-black/20 dark:border-white/20 text-foreground rounded-3xl font-semibold hover:bg-white/20 transition-all duration-300",
    },
  ];

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="relative overflow-hidden bg-transparent border border-border rounded-3xl p-8">
        {/* Pulse Effect */}
        {/* <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" /> */}

       <div className="flex items-center gap-2 mb-2">
  <Sparkles className="w-6 h-6 text-foreground" />
  <span className="text-brand-400 font-semibold">{getGreeting()}</span>
</div>
<h1 className="text-3xl sm:text-4xl font-bold mb-3">
  <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
    Welcome back,&nbsp;
  </span>
  <span className="bg-gradient-to-r from-brand-400 to-brand-500 bg-clip-text text-transparent">
    {user?.firstName || user?.fullName || "there"}!
  </span>
</h1>
<p className="text-gray-300 text-lg mb-6 max-w-2xl">
  Manage your business, invoices, clients, and finances all in one place.\&nbsp;\nStreamline your operations with Framebooks.
</p>


<div className="flex flex-wrap gap-4">
  {quickActions.map((action, idx) => {
    const IconComponent = action.icon;
    return (
      <Link key={idx} href={action.href} className={action.className}>
        <IconComponent className="w-5 h-5" />
        {action.label}
      </Link>
    );
  })}
</div>
      </div>

<ProfileProgress />
<RecentProjectsWidget/>


    </div>
  );
}
