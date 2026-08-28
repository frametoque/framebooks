"use client";
import { Loader } from "@/components/ui/Loader";


import { useEffect, useState } from "react";
import { getTopClients } from "../actions/actions";


const formatLKR = (amount: number) => {
  const isLarge = Math.abs(amount) >= 10000;
  const num = new Intl.NumberFormat(isLarge ? 'en-US' : 'en-LK', {
    notation: isLarge ? 'compact' : 'standard',
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(amount || 0);
  return `${num} LKR`;
};

export default function TopClientsWidget() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getTopClients().then(res => {
      if (active) {
        setData(res);
        setLoading(false);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="bg-transparent border border-border rounded-3xl p-7 flex flex-col justify-between h-full min-h-[420px]">
      <div>
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
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
              <div key={i} className="flex items-center justify-between p-4 bg-transparent border border-border rounded-2xl hover:bg-card transition-colors">
                <div className="flex items-center gap-3">
                  <div className="text-foreground flex items-center justify-center font-bold text-xs shrink-0">
                    #{i + 1}
                  </div>
                  <p className="font-semibold text-sm text-foreground truncate max-w-[150px]">
                    {client.name}
                  </p>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <p className="font-semibold text-sm text-green-400">
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
