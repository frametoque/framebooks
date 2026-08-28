"use client";
import { Loader } from "@/components/ui/Loader";


import { useState, useEffect } from "react";
import { useConfirm } from '@/components/ui/ConfirmProvider';

export default function AuditLogsTab() {
  const { confirm } = useConfirm();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/system-logs");
      if (!res.ok) {
        throw new Error(`Failed to fetch logs: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      } else {
        throw new Error(data.error || "Failed to load logs");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!await confirm("Are you sure you want to clear all system logs? This action cannot be undone.")) {
      return;
    }
    try {
      setClearing(true);
      setError("");
      const res = await fetch("/api/admin/system-logs", {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Failed to clear logs: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.success) {
        alert("System logs cleared successfully!");
        fetchLogs();
      } else {
        throw new Error(data.error || "Failed to clear logs");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClearLogs}
            disabled={loading || clearing}
            className="px-4 py-2 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-3xl transition-colors cursor-pointer font-medium disabled:opacity-50"
          >
            {clearing ? "Clearing..." : "Clear Logs"}
          </button>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading || clearing}
            className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 text-foreground rounded-3xl transition-colors cursor-pointer font-medium disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="bg-transparent border border-border rounded-3xl p-7 sm:p-9">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/35 text-red-400 rounded-3xl text-sm">
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 bg-card rounded-3xl">
            No system logs available yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-gray-400 font-semibold">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Task / Action</th>
                  <th className="py-3 px-4">OS & Client</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-card transition-colors">
                    <td className="py-3.5 px-4 text-gray-300 whitespace-nowrap">
                      {(() => {
                        let dateStr = log.timestamp;
                        if (typeof dateStr === "string" && !dateStr.endsWith("Z") && !dateStr.includes("+")) {
                          dateStr = dateStr.includes("T") ? `${dateStr}Z` : `${dateStr.replace(" ", "T")}Z`;
                        }
                        return new Date(dateStr).toLocaleString();
                      })()}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="text-foreground font-medium">{log.user_email}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{log.device_ip}</p>
                    </td>
                    <td className="py-3.5 px-4 text-gray-200 min-w-[200px]">
                      {log.task}
                    </td>
                    <td className="py-3.5 px-4 text-gray-400 text-xs whitespace-nowrap">
                      <span className="px-2 py-1 bg-card rounded border border-border mr-1.5 text-[10px]">
                        {log.device_os}
                      </span>
                      <span className="px-2 py-1 bg-card rounded border border-border text-[10px]">
                        {log.device_type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
