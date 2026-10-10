"use client";

import { createContext, useContext } from "react";

interface RoleContextType {
  role: string | null;
  actualRole: string | null;
  isReadOnly: boolean;
  isPaymentPending: boolean;
  isGracePeriod: boolean;
  graceDaysRemaining: number | null;
  graceEndDate: string | null;
  planExpiresAt: string | null;
  planName: string;
  canWrite: boolean;
  isViewer: boolean;
}

const RoleContext = createContext<RoleContextType>({
  role: null,
  actualRole: null,
  isReadOnly: false,
  isPaymentPending: false,
  isGracePeriod: false,
  graceDaysRemaining: null,
  graceEndDate: null,
  planExpiresAt: null,
  planName: "Free",
  canWrite: true,
  isViewer: false,
});

export function RoleProvider({
  role,
  actualRole,
  isReadOnly = false,
  isPaymentPending = false,
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
  isPaymentPending?: boolean;
  isGracePeriod?: boolean;
  graceDaysRemaining?: number | null;
  graceEndDate?: string | null;
  planExpiresAt?: string | null;
  planName?: string;
  children: React.ReactNode;
}) {
  const isViewer = isReadOnly || (Boolean(role) && role!.toLowerCase() === "viewer");
  const effectiveRole = isViewer ? "Viewer" : role;
  const userActualRole = actualRole || role;
  const canWrite = !isReadOnly && !isViewer;

  return (
    <RoleContext.Provider
      value={{
        role: effectiveRole,
        actualRole: userActualRole,
        isReadOnly,
        isPaymentPending,
        isGracePeriod,
        graceDaysRemaining,
        graceEndDate,
        planExpiresAt,
        planName,
        canWrite,
        isViewer,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
