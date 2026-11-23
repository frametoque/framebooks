"use client";

import React, { useEffect, useState, useRef } from "react";
import AnimatedNumber from "./AnimatedNumber";

interface AutoFitStatNumberProps {
  value: string | number;
  maxFontSize?: number; // max font size in px (e.g. 28)
  minFontSize?: number; // min font size in px (e.g. 13)
  className?: string; // extra classes
  colorClass?: string; // text color (default "text-foreground")
  title?: string;
  style?: React.CSSProperties;
}

/**
 * AutoFitStatNumber dynamically scales font size to fill the available box width
 * without overflowing or wrapping, scaling down gracefully as digits increase or screen scales.
 */
export default function AutoFitStatNumber({
  value,
  maxFontSize = 28,
  minFontSize = 13,
  className = "",
  colorClass = "text-foreground",
  title,
  style,
}: AutoFitStatNumberProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  const strVal = String(value ?? "");

  // Estimated initial size by length to prevent initial visual jumping before observer fires
  const getInitialSize = () => {
    const len = strVal.length;
    if (len <= 6) return maxFontSize;
    if (len <= 9) return Math.max(minFontSize, Math.round(maxFontSize * 0.92));
    if (len <= 12) return Math.max(minFontSize, Math.round(maxFontSize * 0.82));
    if (len <= 15) return Math.max(minFontSize, Math.round(maxFontSize * 0.72));
    if (len <= 18) return Math.max(minFontSize, Math.round(maxFontSize * 0.62));
    return minFontSize;
  };

  const [fontSize, setFontSize] = useState<number>(getInitialSize);

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const measure = () => {
      const containerWidth = container.clientWidth;
      if (containerWidth <= 0) return;

      const currentSize = parseFloat(window.getComputedStyle(text).fontSize) || fontSize;
      const textWidth = text.scrollWidth;

      if (textWidth <= 0 || currentSize <= 0) return;

      // Leave a tiny 2px cushion to prevent subpixel wrapping
      const availableWidth = containerWidth - 2;
      const idealSize = (currentSize * availableWidth) / textWidth;

      const clamped = Math.min(
        maxFontSize,
        Math.max(minFontSize, Math.floor(idealSize * 10) / 10)
      );

      setFontSize(clamped);
    };

    measure();

    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(container);

    return () => ro.disconnect();
  }, [value, maxFontSize, minFontSize]);

  return (
    <div
      ref={containerRef}
      className={`w-full min-w-0 overflow-hidden leading-tight ${className}`}
      title={title || strVal}
    >
      <span
        ref={textRef}
        style={{ fontSize: `${fontSize}px`, transition: "font-size 0.15s ease-out", ...style }}
        className={`inline-block whitespace-nowrap font-bold tracking-tight ${colorClass}`}
      >
        <AnimatedNumber value={value} />
      </span>
    </div>
  );
}
