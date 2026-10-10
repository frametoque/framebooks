"use client";

import React, { createContext, useContext, useState } from "react";

interface AdminDateRangeContextType {
  dateRange: string;
  startDate: string;
  endDate: string;
  setDateRange: (range: string) => void;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
}

const AdminDateRangeContext = createContext<AdminDateRangeContextType | undefined>(undefined);

export function AdminDateRangeProvider({ children }: { children: React.ReactNode }) {
  const currentYear = new Date().getFullYear();
  const [dateRange, setDateRange] = useState("this year");
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);

  const applyRangeDates = (range: string) => {
    setDateRange(range);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const year = today.getFullYear();

    if (range === "this year") {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    } else if (range === "6 months") {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      setStartDate(d.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (range === "three months") {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      setStartDate(d.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (range === "one month") {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      setStartDate(d.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (range === "lifetime") {
      setStartDate("1970-01-01");
      setEndDate("2099-12-31");
    }
  };

  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("framebooks_default_range") : null;
    if (saved && saved !== "this year") {
      applyRangeDates(saved);
    } else {
      fetch("/api/admin/preferences")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.success && data?.prefs?.defaultViewRange) {
            applyRangeDates(data.prefs.defaultViewRange);
            localStorage.setItem("framebooks_default_range", data.prefs.defaultViewRange);
          }
        })
        .catch(() => null);
    }
  }, []);

  return (
    <AdminDateRangeContext.Provider
      value={{
        dateRange,
        startDate,
        endDate,
        setDateRange,
        setStartDate,
        setEndDate,
      }}
    >
      {children}
    </AdminDateRangeContext.Provider>
  );
}

export function useAdminDateRange() {
  const context = useContext(AdminDateRangeContext);
  if (!context) {
    throw new Error("useAdminDateRange must be used within an AdminDateRangeProvider");
  }
  return context;
}
