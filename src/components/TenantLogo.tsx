"use client";

import React, { useState, useEffect } from "react";
import { Building2 } from "lucide-react";

interface TenantLogoProps {
  logoUrl?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  fallbackClassName?: string;
  iconClassName?: string;
}

export function TenantLogo({
  logoUrl,
  name,
  size = 36,
  className = "w-9 h-9 rounded-full object-cover",
  fallbackClassName = "w-9 h-9 rounded-full bg-card flex items-center justify-center border border-border/50",
  iconClassName = "w-4 h-4 text-gray-400",
}: TenantLogoProps) {
  const cleanUrl = React.useMemo(() => {
    if (!logoUrl) return null;
    const trimmed = String(logoUrl).trim();
    if (!trimmed) return null;
    return trimmed.replace(/^http:\/\//i, "https://");
  }, [logoUrl]);

  const [currentSrc, setCurrentSrc] = useState<string | null>(cleanUrl);
  const [retriedProxy, setRetriedProxy] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentSrc(cleanUrl);
    setRetriedProxy(false);
    setHasError(false);
  }, [cleanUrl]);

  const handleError = () => {
    if (!retriedProxy && cleanUrl && !cleanUrl.startsWith("/") && typeof window !== "undefined" && !cleanUrl.startsWith(window.location.origin)) {
      setRetriedProxy(true);
      setCurrentSrc(`/api/proxy-image?url=${encodeURIComponent(cleanUrl)}`);
    } else {
      setHasError(true);
    }
  };

  if (currentSrc && !hasError) {
    return (
      <img
        src={currentSrc}
        alt={name || "Business Logo"}
        width={size}
        height={size}
        className={className}
        referrerPolicy="no-referrer"
        onError={handleError}
      />
    );
  }

  const initial = name?.trim()?.charAt(0)?.toUpperCase();

  return (
    <div className={fallbackClassName}>
      {initial ? (
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 select-none">
          {initial}
        </span>
      ) : (
        <Building2 className={iconClassName} />
      )}
    </div>
  );
}

export default TenantLogo;
