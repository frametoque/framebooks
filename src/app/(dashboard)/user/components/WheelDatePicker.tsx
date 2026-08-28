"use client";

import { useEffect, useRef, useState } from "react";

interface WheelDatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (date: string) => void;
  onClose: () => void;
  label?: string;
}

const MONTHS = [
  { name: "January", value: 1 },
  { name: "February", value: 2 },
  { name: "March", value: 3 },
  { name: "April", value: 4 },
  { name: "May", value: 5 },
  { name: "June", value: 6 },
  { name: "July", value: 7 },
  { name: "August", value: 8 },
  { name: "September", value: 9 },
  { name: "October", value: 10 },
  { name: "November", value: 11 },
  { name: "December", value: 12 },
];

const getDaysInMonth = (month: number, year: number) => {
  return new Date(year, month, 0).getDate();
};

export default function WheelDatePicker({
  value,
  onChange,
  onClose,
  label = "Select Date"
}: WheelDatePickerProps) {
  // Parse initial date
  const initialParts = value ? value.split("-") : [];
  const initialYear = parseInt(initialParts[0]) || new Date().getFullYear();
  const initialMonth = parseInt(initialParts[1]) || (new Date().getMonth() + 1);
  const initialDay = parseInt(initialParts[2]) || new Date().getDate();

  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedDay, setSelectedDay] = useState(initialDay);

  // Generate Year range (e.g. currentYear - 20 to currentYear + 15)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 45 }, (_, i) => currentYear - 25 + i);

  // Generate Days based on month and year
  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Keep day in range when month or year changes
  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [selectedMonth, selectedYear, daysInMonth, selectedDay]);

  // Construct standard date string when values change
  const handleConfirm = () => {
    const formattedMonth = String(selectedMonth).padStart(2, "0");
    const formattedDay = String(selectedDay).padStart(2, "0");
    onChange(`${selectedYear}-${formattedMonth}-${formattedDay}`);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[#082830] border border-border rounded-2xl shadow-2xl p-4 w-[310px] animate-in zoom-in-95 duration-200 overscroll-contain"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-3 text-center">
          {label}
        </div>

      <div className="relative flex justify-center items-center gap-1 h-[200px] overflow-hidden rounded-xl border border-border bg-black/40">
        {/* Highlight selection bar in the center */}
        <div className="absolute left-0 right-0 h-10 border-y border-border bg-card pointer-events-none z-10" />

        {/* Top and bottom gradient fade-out masks */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#082830] to-transparent pointer-events-none z-20" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#082830] to-transparent pointer-events-none z-20" />

        {/* Month Wheel */}
        <ScrollWheel
          options={MONTHS}
          value={selectedMonth}
          onChange={setSelectedMonth}
          displayKey="name"
          valueKey="value"
          widthClass="w-[110px]"
        />

        {/* Day Wheel */}
        <ScrollWheel
          options={days}
          value={selectedDay}
          onChange={setSelectedDay}
          widthClass="w-[60px]"
        />

        {/* Year Wheel */}
        <ScrollWheel
          options={years}
          value={selectedYear}
          onChange={setSelectedYear}
          widthClass="w-[80px]"
        />
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={onClose}
          className="flex-1 bg-card hover:bg-black/10 dark:hover:bg-white/10 border border-border text-foreground rounded-xl py-2 text-sm font-medium transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-xl py-2 text-sm font-bold transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
    </>
  );
}

interface ScrollWheelProps<T> {
  options: T[];
  value: any;
  onChange: (val: any) => void;
  displayKey?: string;
  valueKey?: string;
  widthClass: string;
}

function ScrollWheel<T>({
  options,
  value,
  onChange,
  displayKey,
  valueKey,
  widthClass
}: ScrollWheelProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isScrollingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Map option to display label and comparison value
  const getOptionLabel = (opt: T) => {
    if (typeof opt === "object" && opt !== null && displayKey) {
      return (opt as any)[displayKey];
    }
    return String(opt);
  };

  const getOptionValue = (opt: T) => {
    if (typeof opt === "object" && opt !== null && valueKey) {
      return (opt as any)[valueKey];
    }
    return opt;
  };

  const optionValues = options.map(getOptionValue);

  // Set position when value changes externally
  useEffect(() => {
    const container = containerRef.current;
    if (container && !isScrollingRef.current) {
      const idx = optionValues.indexOf(value);
      if (idx !== -1) {
        container.scrollTop = idx * 40;
        setActiveIndex(idx);
      }
    }
  }, [value, JSON.stringify(optionValues)]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    isScrollingRef.current = true;
    const scrollTop = container.scrollTop;
    const index = Math.round(scrollTop / 40);

    if (index >= 0 && index < options.length) {
      setActiveIndex(index);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        onChange(optionValues[index]);
        isScrollingRef.current = false;
      }, 100);
    }
  };

  const handleItemClick = (index: number) => {
    const container = containerRef.current;
    if (container) {
      container.scrollTo({
        top: index * 40,
        behavior: "smooth",
      });
      onChange(optionValues[index]);
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className={`h-full ${widthClass} overflow-y-scroll snap-y snap-mandatory scrollbar-none flex flex-col py-[80px] z-10 overscroll-contain`}
      style={{ scrollbarWidth: "none", overscrollBehavior: "contain" }}
    >
      {options.map((opt, i) => {
        const isActive = i === activeIndex;
        const diff = Math.abs(i - activeIndex);

        // Styling scaling & fading based on distance to center
        let itemStyle = "text-gray-500 scale-90 opacity-20";
        if (isActive) {
          itemStyle = "text-foreground scale-110 font-bold opacity-100";
        } else if (diff === 1) {
          itemStyle = "text-gray-300 scale-95 opacity-50";
        } else if (diff === 2) {
          itemStyle = "text-gray-400 scale-90 opacity-30";
        }

        return (
          <div
            key={i}
            onClick={() => handleItemClick(i)}
            className={`h-10 shrink-0 flex items-center justify-center snap-center text-[15px] transition-all duration-150 cursor-pointer ${itemStyle}`}
            style={{
              transform: `perspective(200px) rotateX(${
                isActive ? 0 : (i - activeIndex) * 15
              }deg)`,
            }}
          >
            {getOptionLabel(opt)}
          </div>
        );
      })}
    </div>
  );
}
