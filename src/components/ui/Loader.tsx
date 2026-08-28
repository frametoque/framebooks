"use client";
import React from 'react';
import { motion } from 'framer-motion';

interface LoaderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  variant?: 'dots' | 'pulse' | 'spinner' | 'ring';
}

export function Loader({ className = '', size = 'md', color = 'text-brand-500', variant = 'ring' }: LoaderProps) {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 40,
    xl: 64,
  };
  const px = sizeMap[size];

  if (variant === 'spinner' || variant === 'ring') {
    return (
      <div className={`relative flex items-center justify-center ${className}`} style={{ width: px, height: px }}>
        <motion.span
          className={`absolute rounded-full border-2 border-transparent border-t-current border-r-current ${color}`}
          style={{ width: px, height: px }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <motion.span
          className={`absolute rounded-full border-2 border-transparent border-b-current border-l-current ${color} opacity-30`}
          style={{ width: px, height: px }}
          animate={{ rotate: -360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: px, height: px }}>
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className={`rounded-full bg-current ${color}`}
          style={{ width: px * 0.5, height: px * 0.5 }}
        />
      </div>
    );
  }

  // Dots
  const dotSize = px / 3.5;
  return (
    <div className={`flex items-center justify-center gap-1 ${className}`} style={{ height: px }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -dotSize, 0] }}
          transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", delay: i * 0.15 }}
          className={`rounded-full bg-current ${color}`}
          style={{ width: dotSize, height: dotSize }}
        />
      ))}
    </div>
  );
}
