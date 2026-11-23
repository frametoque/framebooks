"use client";

import { useState, useEffect, useMemo } from "react";
import { getGravatarUrl } from "@/lib/gravatar";

interface ClientAvatarProps {
  imageUrl?: string | null;
  email?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
  size?: number;
}

export default function ClientAvatar({
  imageUrl,
  email,
  name,
  className = "w-9 h-9 rounded-full object-cover flex-shrink-0",
  fallbackClassName = "w-9 h-9 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-foreground font-bold text-sm flex-shrink-0",
  size = 200,
}: ClientAvatarProps) {
  const gravatarUrl = useMemo(() => (email ? getGravatarUrl(email, size) : null), [email, size]);

  const cleanImageUrl = useMemo(() => {
    if (!imageUrl) return null;
    const trimmed = String(imageUrl).trim();
    if (!trimmed) return null;
    return trimmed.replace(/^http:\/\//i, "https://");
  }, [imageUrl]);

  const cleanGravatarUrl = useMemo(() => {
    if (!gravatarUrl) return null;
    const trimmed = String(gravatarUrl).trim();
    if (!trimmed) return null;
    return trimmed.replace(/^http:\/\//i, "https://");
  }, [gravatarUrl]);

  const [primarySrc, setPrimarySrc] = useState<string | null>(cleanImageUrl);
  const [retriedPrimaryProxy, setRetriedPrimaryProxy] = useState(false);
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [gravatarFailed, setGravatarFailed] = useState(false);

  useEffect(() => {
    setPrimarySrc(cleanImageUrl);
    setRetriedPrimaryProxy(false);
    setPrimaryFailed(false);
  }, [cleanImageUrl]);

  useEffect(() => {
    setGravatarFailed(false);
  }, [cleanGravatarUrl]);

  const handlePrimaryError = () => {
    if (!retriedPrimaryProxy && cleanImageUrl && !cleanImageUrl.startsWith("/") && typeof window !== "undefined" && !cleanImageUrl.startsWith(window.location.origin)) {
      setRetriedPrimaryProxy(true);
      setPrimarySrc(`/api/proxy-image?url=${encodeURIComponent(cleanImageUrl)}`);
    } else {
      setPrimaryFailed(true);
    }
  };

  const initial = (name || email || "?").trim().charAt(0).toUpperCase() || "?";

  if (primarySrc && !primaryFailed) {
    return (
      <img
        src={primarySrc}
        alt={name || "Client Avatar"}
        className={className}
        referrerPolicy="no-referrer"
        onError={handlePrimaryError}
      />
    );
  }

  if (cleanGravatarUrl && !gravatarFailed) {
    return (
      <img
        src={cleanGravatarUrl}
        alt={name || "Client Avatar"}
        className={className}
        referrerPolicy="no-referrer"
        onError={() => setGravatarFailed(true)}
      />
    );
  }

  return (
    <div className={fallbackClassName}>
      {initial}
    </div>
  );
}
