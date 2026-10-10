"use client";
import { Loader } from "@/components/ui/Loader";


import { useEffect, useState } from "react";
import { getTopClients } from "../actions/actions";


const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0));
  return `${num} LKR`;
};

export default function TopClientsWidget({ initialData }: { initialData?: any[] }) {
  const [data, setData] = useState<any[]>(initialData || []);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }

    let active = true;
    getTopClients().then(res => {
      if (active) {
        setData(res || []);
        setLoading(false);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [initialData]);

  return (
    <div className="bg-card border border-border rounded-3xl p-7 flex flex-col justify-between h-full min-h-[420px] shadow-xs">
      <div>
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-foreground">
          Top Clients
        </h2>
        
        {loading ? (
          <div className="flex justify-center items-center h-[200px]">
            <Loader />
          </div>
        ) : data.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No clients found.</p>
        ) : (
          <div className="space-y-4">
            {data.map((client, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-black/[0.02] dark:bg-card border border-border rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="text-gray-500 dark:text-gray-400 flex items-center justify-center font-bold text-xs shrink-0">
                    #{i + 1}
                  </div>
                  <p className="font-semibold text-sm text-foreground truncate max-w-[150px]">
                    {client.name}
                  </p>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <p className="font-semibold text-sm text-emerald-600 dark:text-green-400">
                    {formatLKR(client.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
