"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

export function isChristmasSeason(now: Date = new Date()): boolean {
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  // Auto-starts every year from December 1 (12-01) to December 31 (12-31)
  return month === 12 && day >= 1 && day <= 31;
}

export function isSeasonalEffectsAllowed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = localStorage.getItem("framebooks_seasonal_effects");
    if (val === "false") return false;
  } catch {}
  return true;
}

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  speedX: number;
  phase: number;
  phaseSpeed: number;
  alpha: number;
}

export function ChristmasSnowfall() {
  const { resolvedTheme, theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [enabled, setEnabled] = useState<boolean>(() => {
    return isChristmasSeason() && isSeasonalEffectsAllowed();
  });

  useEffect(() => {
    const checkState = () => {
      const inSeason = isChristmasSeason();
      const userAllowed = isSeasonalEffectsAllowed();
      setEnabled(inSeason && userAllowed);
    };

    checkState();

    const handleToggle = (e: Event) => {
      const custom = e as CustomEvent<boolean>;
      if (typeof custom.detail === "boolean") {
        setEnabled(isChristmasSeason() && custom.detail);
      } else {
        checkState();
      }
    };

    window.addEventListener("seasonal-effects:change", handleToggle);
    window.addEventListener("storage", checkState);
    return () => {
      window.removeEventListener("seasonal-effects:change", handleToggle);
      window.removeEventListener("storage", checkState);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const isDark = (resolvedTheme || theme) === "dark";

    // Generate balanced snowflake particles
    const count = Math.min(50, Math.max(25, Math.floor(width / 35)));
    const flakes: Snowflake[] = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1.2 + Math.random() * 2.4,
      speedY: 0.4 + Math.random() * 0.9,
      speedX: 0,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.01 + Math.random() * 0.02,
      alpha: 0.25 + Math.random() * 0.55,
    }));

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const render = () => {
      if (document.hidden) {
        animationId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < flakes.length; i++) {
        const flake = flakes[i];

        flake.phase += flake.phaseSpeed;
        flake.speedX = Math.sin(flake.phase) * 0.45;
        flake.y += flake.speedY;
        flake.x += flake.speedX;

        // Wrap around vertically & horizontally
        if (flake.y > height + 10) {
          flake.y = -10;
          flake.x = Math.random() * width;
        }
        if (flake.x > width + 10) {
          flake.x = -10;
        } else if (flake.x < -10) {
          flake.x = width + 10;
        }

        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);

        if (isDark) {
          ctx.fillStyle = `rgba(255, 255, 255, ${flake.alpha})`;
        } else {
          ctx.fillStyle = `rgba(140, 185, 225, ${flake.alpha * 0.75})`;
        }

        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, [enabled, resolvedTheme, theme]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full select-none"
    />
  );
}

export default ChristmasSnowfall;
