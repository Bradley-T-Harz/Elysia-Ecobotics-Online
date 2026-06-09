export default function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "safe" | "warning" | "danger" }) {
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}
