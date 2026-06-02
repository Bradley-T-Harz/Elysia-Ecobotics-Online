type TrustBadgeProps = {
  label: string;
  tone?: "official" | "safe" | "warning" | "danger" | "neutral";
};

export default function TrustBadge({ label, tone = "neutral" }: TrustBadgeProps) {
  return <span className={`trust-badge trust-badge--${tone}`}>{label}</span>;
}
