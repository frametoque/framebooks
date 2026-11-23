"use client";

import { motion, AnimatePresence } from "framer-motion";
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
    <div className="flex items-center text-gray-700 dark:text-gray-300 overflow-hidden">
      <div className="font-medium tabular-nums text-sm flex items-center h-[20px]">
        {timeStr.split("").map((char, index) => {
          if (isNaN(parseInt(char, 10))) {
            return (
              <span key={`static-${index}`} className="opacity-70 mx-[1px]">
                {char}
              </span>
            );
          }
          return (
            <div key={index} className="relative flex justify-center items-center" style={{ width: "0.55em", height: "1.2em" }}>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={char}
                  initial={{ y: "100%", opacity: 0, position: "absolute" }}
                  animate={{ y: "0%", opacity: 1, position: "absolute" }}
                  exit={{ y: "-100%", opacity: 0, position: "absolute" }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  {char}
                </motion.span>
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
