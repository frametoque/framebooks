"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type AnalyticsDateRange =
  | "today"
  | "24 hours"
  | "one month"
  | "three months"
  | "6 months"
  | "this year"
  | "all time";

interface AnalyticsDateRangeContextValue {
  dateRange: AnalyticsDateRange;
  setDateRange: (range: AnalyticsDateRange) => void;
}

const AnalyticsDateRangeContext = createContext<AnalyticsDateRangeContextValue>({
  dateRange: "all time",
  setDateRange: () => {},
});

export function AnalyticsDateRangeProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>("all time");
  return (
    <AnalyticsDateRangeContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </AnalyticsDateRangeContext.Provider>
  );
}

export function useAnalyticsDateRange() {
  return useContext(AnalyticsDateRangeContext);
}
