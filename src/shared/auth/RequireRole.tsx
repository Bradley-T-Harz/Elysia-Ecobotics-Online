import type { ReactNode } from "react";
import RequireMember from "./RequireMember";

export default function RequireRole({ children, role }: { children: ReactNode; role: string }) {
  return <RequireMember label={`${role} access requires a verified Commons Circle role.`}>{children}</RequireMember>;
}
