"use client";

import { Loader } from "@/components/ui/Loader";
import { useEffect, useState } from "react";
import { getTopClients } from "../actions/actions";
import { useAccentTheme } from "@/lib/theme/useAccentTheme";

const formatCurrencyLKR = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return "LKR 0";
  const num = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return `LKR ${num}`;
};

interface TopClientsWidgetProps {
  initialData?: any[];
  totalIncome?: number;
}

export default function TopClientsWidget({
  initialData,
  totalIncome,
}: TopClientsWidgetProps) {
  const [data, setData] = useState<any[]>(initialData || []);
  const [loading, setLoading] = useState(!initialData);
  const { accent } = useAccentTheme();

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }

    let active = true;
    getTopClients()
      .then((res) => {
        if (active) {
          setData(res || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialData]);

  const top5Clients = data.slice(0, 5);

  const denom =
    typeof totalIncome === "number" && totalIncome > 0
      ? totalIncome
      : data.reduce((acc, c) => acc + (Number(c.value) || 0), 0);

  const top5Revenue = top5Clients.reduce(
    (acc, c) => acc + (Number(c.value) || 0),
    0
  );
  const top5Share =
    denom > 0 ? ((top5Revenue / denom) * 100).toFixed(1) : "0.0";
  const avgSalePerClient =
    top5Clients.length > 0 ? top5Revenue / top5Clients.length : 0;

  return (
    <div className="bg-card border border-border rounded-3xl p-6 flex flex-col justify-between h-full min-h-[420px] shadow-xs">
      <div>
        <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight mb-4 sm:mb-5">
          Top Clients &amp; Sales Share
        </h3>

        {loading ? (
          <div className="flex justify-center items-center h-[200px]">
            <Loader />
          </div>
        ) : top5Clients.length === 0 ? (
          <p className="text-gray-400 text-xs text-center py-8">
            No clients found.
          </p>
        ) : (
          <div className="space-y-3">
            {top5Clients.map((client, i) => {
              const val = Number(client.value || 0);
              const share =
                denom > 0 ? ((val / denom) * 100).toFixed(1) : "0.0";

              return (
                <div
                  key={client.id || i}
                  className="bg-black/[0.02] dark:bg-card border border-border rounded-2xl p-3.5 space-y-2 shadow-2xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="px-2 py-0.5 rounded-lg text-[11px] font-bold border shrink-0"
                        style={{
                          backgroundColor: `${accent}18`,
                          color: accent,
                          borderColor: `${accent}35`,
                        }}
                      >
                        #{i + 1}
                      </span>
                      <span className="font-semibold text-xs text-foreground truncate">
                        {client.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-bold text-xs text-foreground tabular-nums">
                        {formatCurrencyLKR(val)}
                      </span>
                      <span
                        className="font-bold text-xs tabular-nums w-11 text-right"
                        style={{ color: accent }}
                      >
                        {share}%
                      </span>
                    </div>
                  </div>

                  {/* Accent Fill Bar */}
                  <div className="h-1.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(4, Number(share)))}%`,
                        backgroundColor: accent,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Concentration Stats */}
      {!loading && top5Clients.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-black/[0.02] dark:bg-card border border-border rounded-2xl p-3.5 shadow-2xs">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              TOP 5 CLIENTS SHARE
            </p>
            <p className="text-lg font-bold text-foreground tracking-tight tabular-nums">
              {top5Share}%
            </p>
          </div>

          <div className="bg-black/[0.02] dark:bg-card border border-border rounded-2xl p-3.5 shadow-2xs">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              AVERAGE SALE PER CLIENT
            </p>
            <p
              className="text-lg font-bold tracking-tight tabular-nums"
              style={{ color: accent }}
            >
              {formatCurrencyLKR(avgSalePerClient)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
