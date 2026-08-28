"use client";
import { Loader } from "@/components/ui/Loader";


import { useEffect, useState } from "react";
import { useSession, signOut } from 'next-auth/react';
import { Loader2, UserCheck } from "lucide-react";
import Link from "next/link";

export default function ProfileProgress() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const isLoaded = status !== "loading";

  const [progress, setProgress] = useState(0);
  const [missingFields, setMissingFields] = useState([]);
  const [loading, setLoading] = useState(true);

  const [data, setData] = useState({
    fullName: "",
    email: "",
    phone: "",
    company: "",
    website: "",
    address: "",
  });

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const res = await fetch(`/api/users/get-profile?userId=${user.id}`);
        const json = await res.json();

        if (json.success) {
          const p = json.profile || {};

          const finalData = {
            fullName: p.fullName || user?.name || "",
            email: p.email || user?.email || "",
            phone: p.phone || "",
            company: p.company || "",
            website: p.website || "",
            address: p.address || "",
          };

          setData(finalData);

          const required = [
            { key: "fullName", label: "Full Name" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "address", label: "Address" },
          ];

          const missingRequired = required
            .filter((f) => !finalData[f.key] || finalData[f.key].trim() === "")
            .map((f) => f.label);

          setMissingFields(missingRequired);

          const filledCount = required.length - missingRequired.length;
          const progressPercent = Math.round((filledCount / required.length) * 100);

          setProgress(progressPercent);
        }
      } catch (e) {
        console.error("ProfileProgress error:", e);
      }

      setLoading(false);
    };

    loadProfile();
  }, [user]);

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader size="sm" />
      </div>
    );
  }

  if (progress === 100) return null;

  return (
    <div className="p-6 rounded-3xl bg-transparent border border-border backdrop-blur-xl relative overflow-hidden">
     
      {/* <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" /> */}

      <div className="flex items-center gap-2 mb-2">
        <UserCheck className="w-6 h-6 text-foreground" />
        <span className="text-brand-400 font-semibold">Profile Status</span>
      </div>

      <h2 className="text-xl font-bold mb-3">
        Hey{" "}
        <span className="bg-gradient-to-r from-brand-400 to-brand-500 bg-clip-text text-transparent">
          {user?.name?.split(' ')[0] || "there"}
        </span>
        , let’s complete your profile!
      </h2>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between mb-1 text-sm text-gray-300">
          <span>Completion</span>
          <span className="text-brand-400 font-semibold">{progress}%</span>
        </div>

        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {missingFields.length > 0 && (
        <p className="text-sm text-gray-400 mb-4">
          You still need to complete:
          <span className="text-gray-200"> {missingFields.join(", ")}</span>
        </p>
      )}

      <Link
        href="/dashboard/settings"
        className="inline-block px-5 py-2 bg-white/10 hover:opacity-90 text-foreground font-semibold rounded-3xl transition-colors"
      >
        Complete Profile
      </Link>
    </div>
  );
}
