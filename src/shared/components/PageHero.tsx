import type { ReactNode } from "react";

type PageHeroProps = { eyebrow: string; title: string; children: ReactNode; actions?: ReactNode; };

export default function PageHero({ eyebrow, title, children, actions }: PageHeroProps) {
  return (
    <section className="page-hero-block">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <div className="hero-text">{children}</div>
      {actions && <div className="hero-actions">{actions}</div>}
    </section>
  );
}
