"use client";

import { createContext, useContext } from "react";

interface RoleContextType {
  role: string | null;
  actualRole: string | null;
  isReadOnly: boolean;
  isGracePeriod: boolean;
  graceDaysRemaining: number | null;
  graceEndDate: string | null;
  planExpiresAt: string | null;
  planName: string;
  canWrite: boolean;
}

const RoleContext = createContext<RoleContextType>({
  role: null,
  actualRole: null,
  isReadOnly: false,
  isGracePeriod: false,
  graceDaysRemaining: null,
  graceEndDate: null,
  planExpiresAt: null,
  planName: "Free",
  canWrite: true,
});

export function RoleProvider({
  role,
  actualRole,
  isReadOnly = false,
  isGracePeriod = false,
  graceDaysRemaining = null,
  graceEndDate = null,
  planExpiresAt = null,
  planName = "Free",
  children,
}: {
  role: string | null;
  actualRole?: string | null;
  isReadOnly?: boolean;
  isGracePeriod?: boolean;
  graceDaysRemaining?: number | null;
  graceEndDate?: string | null;
  planExpiresAt?: string | null;
  planName?: string;
  children: React.ReactNode;
}) {
  const effectiveRole = isReadOnly ? "Viewer" : role;
  const userActualRole = actualRole || role;
  const canWrite = !isReadOnly && effectiveRole !== "Viewer";

  return (
    <RoleContext.Provider
      value={{
        role: effectiveRole,
        actualRole: userActualRole,
        isReadOnly,
        isGracePeriod,
        graceDaysRemaining,
        graceEndDate,
        planExpiresAt,
        planName,
        canWrite,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
