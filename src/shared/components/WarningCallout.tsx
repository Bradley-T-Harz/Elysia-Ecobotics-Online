import type { ReactNode } from "react";

export default function WarningCallout({ title, children }: { title: string; children: ReactNode }) {
  return <aside className="warning-callout"><strong>{title}</strong><div>{children}</div></aside>;
}
