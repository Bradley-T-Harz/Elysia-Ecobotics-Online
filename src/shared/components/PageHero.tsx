import type { ReactNode } from "react";
import PageBrandMark, { type PageBrandMarkVariant } from "./PageBrandMark";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  brandMark?: PageBrandMarkVariant;
};

export default function PageHero({ eyebrow, title, children, actions, brandMark }: PageHeroProps) {
  return (
    <section className={`page-hero-block${brandMark ? " page-hero-block--with-brand-mark" : ""}`}>
      {brandMark && <PageBrandMark variant={brandMark} />}
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="hero-title-brand-font">{title}</h1>
      <div className="hero-text">{children}</div>
      {actions && <div className="hero-actions">{actions}</div>}
    </section>
  );
}
