"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { AdminFlowHost } from "./admin-flow-host";
import type { AdminFlow } from "./types";

interface AdminFlowContextValue {
  activeFlow: AdminFlow | null;
  openFlow: (flow: AdminFlow) => void;
  closeFlow: () => void;
}

const AdminFlowContext = createContext<AdminFlowContextValue | null>(null);

export function AdminFlowProvider({ children }: { children: React.ReactNode }) {
  const [activeFlow, setActiveFlow] = useState<AdminFlow | null>(null);

  const value = useMemo<AdminFlowContextValue>(
    () => ({
      activeFlow,
      openFlow: (flow) => setActiveFlow(flow),
      closeFlow: () => setActiveFlow(null),
    }),
    [activeFlow]
  );

  return (
    <AdminFlowContext.Provider value={value}>
      {children}
      <AdminFlowHost activeFlow={activeFlow} onClose={value.closeFlow} />
    </AdminFlowContext.Provider>
  );
}

export function useAdminFlow() {
  const context = useContext(AdminFlowContext);
  if (!context) {
    throw new Error("useAdminFlow must be used within an AdminFlowProvider.");
  }
  return context;
}
