export type PageBrandMarkVariant = "standard" | "home-floating" | "marketplace-column" | "mission-centered";

type PageBrandMarkProps = {
  variant?: PageBrandMarkVariant;
  className?: string;
};

export default function PageBrandMark({ variant = "standard", className = "" }: PageBrandMarkProps) {
  return (
    <span className={`page-brand-mark page-brand-mark--${variant}${className ? ` ${className}` : ""}`} aria-label="Elysia Ecobotics TM">
      <span className="page-brand-mark__name">Elysia Ecobotics</span>
      <sup className="page-brand-mark__tm">TM</sup>
    </span>
  );
}
