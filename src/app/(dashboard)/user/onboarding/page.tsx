"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from 'next-auth/react';

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const [formData, setFormData] = useState({
    businessName: "",
    address: "",
    plan: "Free",
    accountName: "Cash",
    initialBalance: 0,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      if (res.ok) {
        router.push("/user");
      } else {
        const error = await res.json();
        alert("Failed: " + error.message);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6 text-foreground">
      <div className="max-w-md w-full bg-transparent border border-border rounded-2xl p-8">
        <h1 className="text-3xl font-bold mb-2">Welcome to FrameBookss</h1>
        <p className="text-gray-400 mb-8">Let's set up your business profile.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Business Name</label>
            <input 
              required 
              type="text" 
              className="w-full bg-[#0a0a0f] border border-border rounded-xl px-4 py-3 outline-none focus:border-[#169FE4]"
              value={formData.businessName}
              onChange={(e) => setFormData({...formData, businessName: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Address</label>
            <input 
              required 
              type="text" 
              className="w-full bg-[#0a0a0f] border border-border rounded-xl px-4 py-3 outline-none focus:border-[#169FE4]"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Plan Tier</label>
            <select 
              className="w-full bg-[#0a0a0f] border border-border rounded-xl px-4 py-3 outline-none focus:border-[#169FE4]"
              value={formData.plan}
              onChange={(e) => setFormData({...formData, plan: e.target.value})}
            >
              <option value="Free">Free</option>
              <option value="Pro">Pro (LKR 2,500/mo)</option>
              <option value="Pro Plus">Pro Plus (LKR 5,000/mo)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-medium text-gray-300 mb-4">Initial Account (LKR)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Account Name</label>
                <input 
                  required 
                  type="text" 
                  className="w-full bg-[#0a0a0f] border border-border rounded-xl px-4 py-2 outline-none focus:border-[#169FE4]"
                  value={formData.accountName}
                  onChange={(e) => setFormData({...formData, accountName: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Initial Balance</label>
                <input 
                  required 
                  type="number" 
                  className="w-full bg-[#0a0a0f] border border-border rounded-xl px-4 py-2 outline-none focus:border-[#169FE4]"
                  value={formData.initialBalance}
                  onChange={(e) => setFormData({...formData, initialBalance: parseFloat(e.target.value)})}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#169FE4] hover:bg-[#0288D1] text-foreground py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
