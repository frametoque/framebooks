// src/app/(dashboard)/admin/audit-logs/AuditLogsClient.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Download, 
  Code2, 
  ChevronLeft, 
  ChevronRight,
  Terminal
} from "lucide-react";
import { RoleBadge } from "@/components/Formatters";
import { JsonDiffModal } from "@/app/(dashboard)/admin/_components/JsonDiffModal";

export function AuditLogsClient({
  initialData,
  searchParams,
}: {
  initialData: any;
  searchParams: any;
}) {
  const router = useRouter();
  const [selectedDiff, setSelectedDiff] = useState<any | null>(null);

  const { logs, totalCount, totalPages, page } = initialData;

  const updateFilters = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    });
    params.set("page", "1");
    router.push(`/admin/audit-logs?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(newPage));
    router.push(`/admin/audit-logs?${params.toString()}`);
  };

  const exportCSV = () => {
    const headers = ["ID", "Actor", "Role", "Action", "Target", "Target ID", "IP", "Timestamp"];
    const csvContent = [
      headers.join(","),
      ...logs.map((l: any) =>
        [
          l.id,
          `"${l.actor_email || ''}"`,
          l.actor_role,
          `"${l.action}"`,
          l.target_type || '',
          l.target_id || '',
          l.ip_address || '',
          `"${new Date(l.created_at).toISOString()}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `audit_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Search & Export Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              defaultValue={searchParams.actor || ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateFilters({ actor: (e.target as HTMLInputElement).value });
                }
              }}
              placeholder="Search actor email..."
              className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-full text-xs sm:text-sm outline-none focus:border-brand-500 shadow-2xs"
            />
          </div>

          <div className="relative flex-1 sm:w-60">
            <input
              type="text"
              defaultValue={searchParams.action || ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateFilters({ action: (e.target as HTMLInputElement).value });
                }
              }}
              placeholder="Filter action (e.g. CLEANUP)..."
              className="w-full px-4 py-2 bg-card border border-border rounded-full text-xs sm:text-sm outline-none focus:border-brand-500 shadow-2xs"
            />
          </div>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold bg-card hover:bg-muted/50 border border-border rounded-full text-foreground transition-colors shadow-2xs cursor-pointer shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-50/75 dark:bg-white/[0.02] text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                <th className="p-4">Actor</th>
                <th className="p-4">Role</th>
                <th className="p-4">Action</th>
                <th className="p-4">Target</th>
                <th className="p-4">IP</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground text-sm">
                    No audit records found
                  </td>
                </tr>
              ) : (
                logs.map((l: any) => (
                  <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium text-foreground">
                      {l.actor_email || "System"}
                    </td>

                    <td className="p-4">
                      <RoleBadge role={l.actor_role || "system"} />
                    </td>

                    <td className="p-4">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground">
                        {l.action}
                      </span>
                    </td>

                    <td className="p-4 text-xs text-muted-foreground capitalize">
                      {l.target_type ? `${l.target_type} #${l.target_id || ''}` : "—"}
                    </td>

                    <td className="p-4 text-xs font-mono text-muted-foreground">
                      {l.ip_address || "—"}
                    </td>

                    <td className="p-4 text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      })}
                    </td>

                    <td className="p-4 text-right">
                      {(l.before_state || l.after_state) ? (
                        <button
                          onClick={() => setSelectedDiff(l)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
                        >
                          <Code2 className="w-3.5 h-3.5" />
                          <span>View state</span>
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedDiff && (
        <JsonDiffModal
          isOpen={!!selectedDiff}
          title={`Diff: ${selectedDiff.action} on ${selectedDiff.target_type}`}
          before={selectedDiff.before_state}
          after={selectedDiff.after_state}
          onClose={() => setSelectedDiff(null)}
        />
      )}
    </div>
  );
}
