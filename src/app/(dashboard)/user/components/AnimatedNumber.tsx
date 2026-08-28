"use client";

import React, { useEffect, useState, useRef } from "react";

interface AnimatedNumberProps {
  value: string | number;
  duration?: number; // duration in ms
  className?: string;
}

/**
 * AnimatedNumber component that smoothly counts up to numbers embedded inside formatted strings
 * (e.g. "Rs. 150,000.00", "LKR 45,000", "98.5%", "1,234", "12", "Rs. 0.00", etc.)
 */
export default function AnimatedNumber({
  value,
  duration = 1000,
  className = "",
}: AnimatedNumberProps) {
  const strVal = String(value ?? "");
  const [displayValue, setDisplayValue] = useState<string>(strVal);

  useEffect(() => {
    // Regex to match numbers with optional commas and decimals
    // Group 1: formatted number string e.g. "150,000.00" or "45,000" or "98.5" or "10"
    const numRegex = /\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?/g;
    const matches = strVal.match(numRegex);

    if (!matches || matches.length === 0) {
      setDisplayValue(strVal);
      return;
    }

    const targets = matches.map((m) => {
      const cleanNum = m.replace(/,/g, "");
      const targetVal = parseFloat(cleanNum);
      const parts = cleanNum.split(".");
      const decimals = parts.length > 1 ? parts[1].length : 0;
      const useCommas = m.includes(",");
      return {
        target: isNaN(targetVal) ? 0 : targetVal,
        decimals,
        useCommas,
      };
    });

    let animationFrameId: number;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      // Ease out quad formula
      const easedProgress = progress * (2 - progress);

      let matchIndex = 0;
      const currentFormattedStr = strVal.replace(numRegex, (fullMatch) => {
        const info = targets[matchIndex];
        matchIndex++;
        if (!info) return fullMatch;

        const currentNum = info.target * easedProgress;

        let numStr = "";
        if (info.decimals > 0) {
          numStr = currentNum.toFixed(info.decimals);
        } else {
          numStr = Math.round(currentNum).toString();
        }

        if (info.useCommas) {
          const numParts = numStr.split(".");
          numParts[0] = numParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          numStr = numParts.join(".");
        }

        return numStr;
      });

      setDisplayValue(currentFormattedStr);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(strVal);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [value, duration, strVal]);

  let finalRender: React.ReactNode = <>{displayValue}</>;
  
  if (displayValue.endsWith(" LKR")) {
    const numPart = displayValue.slice(0, -4);
    finalRender = (
      <>
        {numPart}
        <span className="text-[0.6em] text-gray-500 font-bold ml-1.5 uppercase tracking-wider relative -top-[0.1em]">LKR</span>
      </>
    );
  }

  return <span className={className}>{finalRender}</span>;
}
