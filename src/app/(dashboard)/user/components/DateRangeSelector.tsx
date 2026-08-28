"use client";

import { useState, useEffect } from "react";
import { MdCalendarToday } from "react-icons/md";
import WheelDatePicker from "./WheelDatePicker";

interface DateRangeSelectorProps {
  dateRange: string;
  startDate: string;
  endDate: string;
  onRangeChange: (range: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export default function DateRangeSelector({
  dateRange,
  startDate,
  endDate,
  onRangeChange,
  onStartDateChange,
  onEndDateChange
}: DateRangeSelectorProps) {
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);
  const [activePicker, setActivePicker] = useState<"start" | "end" | null>(null);

  // Sync internal temp dates with parent when props change
  useEffect(() => {
    setTempStartDate(startDate);
  }, [startDate]);

  useEffect(() => {
    setTempEndDate(endDate);
  }, [endDate]);
  
  const handleRangeChange = (range: string) => {
    onRangeChange(range);
    setActivePicker(null);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (range === "this year") {
      onStartDateChange(`${today.getFullYear()}-01-01`);
      onEndDateChange(todayStr);
    } else if (range === "6 months") {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      onStartDateChange(d.toISOString().split("T")[0]);
      onEndDateChange(todayStr);
    } else if (range === "three months") {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      onStartDateChange(d.toISOString().split("T")[0]);
      onEndDateChange(todayStr);
    } else if (range === "one month") {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      onStartDateChange(d.toISOString().split("T")[0]);
      onEndDateChange(todayStr);
    } else if (range === "custom") {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      let fyStartYear = currentYear;
      let fyEndYear = currentYear + 1;
      if (currentMonth < 3) { // Jan, Feb, Mar
        fyStartYear = currentYear - 1;
        fyEndYear = currentYear;
      }
      onStartDateChange(`${fyStartYear}-04-01`);
      onEndDateChange(`${fyEndYear}-03-31`);
    } else if (range === "lifetime") {
      onStartDateChange("1970-01-01");
      const tzoffset = (new Date()).getTimezoneOffset() * 60000;
      onEndDateChange((new Date(Date.now() - tzoffset)).toISOString().split('T')[0]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex items-center">
        <select
          value={dateRange}
          onChange={(e) => handleRangeChange(e.target.value)}
          className="bg-transparent border border-border rounded-xl pl-4 pr-10 py-2 outline-none focus:border-brand-500 transition-colors appearance-none cursor-pointer text-sm font-medium text-foreground"
        >
          <option value="lifetime" className="bg-brand-900 text-foreground">Lifetime</option>
          <option value="this year" className="bg-brand-900 text-foreground">This Year</option>
          <option value="6 months" className="bg-brand-900 text-foreground">Last 6 Months</option>
          <option value="three months" className="bg-brand-900 text-foreground">Last 3 Months</option>
          <option value="one month" className="bg-brand-900 text-foreground">Last Month</option>
          <option value="custom" className="bg-brand-900 text-foreground">Custom Range</option>
        </select>
        <span className="absolute right-4 pointer-events-none text-gray-400">
          <ChevronIcon />
        </span>
      </div>

      {dateRange === "custom" && (
        <div className="flex flex-wrap items-center gap-2.5 animate-in slide-in-from-left duration-200">
          {/* Start Date Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePicker(activePicker === "start" ? null : "start")}
              className="bg-transparent border border-border hover:border-black/20 dark:border-white/20 active:bg-white/10 rounded-xl px-4 py-2 text-sm text-foreground flex items-center gap-2 transition-all cursor-pointer shadow-sm select-none"
            >
              <MdCalendarToday className="w-4 h-4 text-foreground" />
              <span>{formatDateFriendly(tempStartDate)}</span>
            </button>
            {activePicker === "start" && (
              <div className="absolute left-0 z-50">
                <WheelDatePicker
                  value={tempStartDate}
                  onChange={(date) => setTempStartDate(date)}
                  onClose={() => setActivePicker(null)}
                  label="Start Date"
                />
              </div>
            )}
          </div>

          <span className="text-gray-400 text-xs uppercase font-semibold select-none">to</span>

          {/* End Date Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePicker(activePicker === "end" ? null : "end")}
              className="bg-transparent border border-border hover:border-black/20 dark:border-white/20 active:bg-white/10 rounded-xl px-4 py-2 text-sm text-foreground flex items-center gap-2 transition-all cursor-pointer shadow-sm select-none"
            >
              <MdCalendarToday className="w-4 h-4 text-foreground" />
              <span>{formatDateFriendly(tempEndDate)}</span>
            </button>
            {activePicker === "end" && (
              <div className="absolute right-0 z-50 w-[310px]">
                <WheelDatePicker
                  value={tempEndDate}
                  onChange={(date) => setTempEndDate(date)}
                  onClose={() => setActivePicker(null)}
                  label="End Date"
                />
              </div>
            )}
          </div>

          {/* Apply/Cancel Actions */}
          {(tempStartDate !== startDate || tempEndDate !== endDate) && (
            <div className="flex items-center gap-2 ml-1 animate-in slide-in-from-left duration-200">
              <button
                type="button"
                onClick={() => {
                  onStartDateChange(tempStartDate);
                  onEndDateChange(tempEndDate);
                  setActivePicker(null);
                }}
                className="bg-brand-500 hover:bg-brand-400 active:bg-brand-700 text-brand-900 rounded-xl px-4 py-2 text-sm font-bold transition-all cursor-pointer shadow-md shadow-brand-500/20"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => {
                  setTempStartDate(startDate);
                  setTempEndDate(endDate);
                  setActivePicker(null);
                }}
                className="bg-card hover:bg-black/10 dark:hover:bg-white/10 border border-border text-foreground rounded-xl px-3 py-2 text-sm transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDateFriendly(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return `${monthNames[monthIdx]} ${day}, ${year}`;
}

function ChevronIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  );
}
