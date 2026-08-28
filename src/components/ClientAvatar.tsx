"use client";

import { useState } from "react";
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
  const gravatarUrl = email ? getGravatarUrl(email, size) : null;

  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [gravatarFailed, setGravatarFailed] = useState(false);

  const initial = (name || email || "?").trim().charAt(0).toUpperCase() || "?";

  if (imageUrl && !primaryFailed) {
    return (
      <img
        src={imageUrl}
        alt={name || "Client Avatar"}
        className={className}
        onError={() => setPrimaryFailed(true)}
      />
    );
  }

  if (gravatarUrl && !gravatarFailed) {
    return (
      <img
        src={gravatarUrl}
        alt={name || "Client Avatar"}
        className={className}
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
