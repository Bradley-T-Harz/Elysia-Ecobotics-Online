import type { ReactNode } from "react";

export default function FeatureCard({ title, children, tone = "neutral" }: { title: string; children: ReactNode; tone?: "neutral" | "safe" | "warning" | "danger" }) {
  return <article className={`feature-card feature-card--${tone}`}><h3>{title}</h3><div>{children}</div></article>;
}
