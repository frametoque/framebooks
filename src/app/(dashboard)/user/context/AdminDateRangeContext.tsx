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
  const [dateRange, setDateRange] = useState("lifetime");
  const [startDate, setStartDate] = useState("1970-01-01");
  const [endDate, setEndDate] = useState("2099-12-31");

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
