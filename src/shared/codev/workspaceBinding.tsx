import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { WorkspaceController } from "./useBrowserWorkspace";
export type CodevWorkspaceBinding = {
  controller: WorkspaceController;
  canEdit: () => boolean;
  beforeRefresh: () => Promise<void>;
  diagnostics?: () => string[];
  sourceDescription?: () => string;
  onChanged?: (message: string) => void;
};
export const CodevBindingContext = createContext<
  ((binding: CodevWorkspaceBinding | null) => void) | null
>(null);
export function CodevWorkspaceBindingRegistration({
  binding,
}: {
  binding: CodevWorkspaceBinding;
}) {
  const register = useContext(CodevBindingContext);
  useEffect(() => {
    register?.(binding);
    return () => register?.(null);
  }, [register, binding]);
  return null;
}
export function CodevBindingProvider({
  register,
  children,
}: {
  register: (binding: CodevWorkspaceBinding | null) => void;
  children: ReactNode;
}) {
  return (
    <CodevBindingContext.Provider value={register}>
      {children}
    </CodevBindingContext.Provider>
  );
}
