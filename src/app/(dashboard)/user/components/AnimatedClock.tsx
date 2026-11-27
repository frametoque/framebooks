"use client";

import { useEffect, useState } from "react";

export function AnimatedClock() {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-US", {
          timeZone: "Asia/Colombo",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateDateTime();
    const clockInterval = setInterval(updateDateTime, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  if (!timeStr) {
    return (
      <div className="flex items-center text-gray-700 dark:text-gray-300">
        <span className="font-medium tabular-nums text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center text-gray-700 dark:text-gray-300">
      <span className="font-medium tabular-nums text-sm select-none">{timeStr}</span>
    </div>
  );
}
