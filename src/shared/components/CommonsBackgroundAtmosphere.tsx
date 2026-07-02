import type { CSSProperties, ReactNode } from "react";
import { getCommonsBackgroundStyleOption } from "../commonsBackgroundStyles";
import { safeCommonsAccentColor } from "../commonsCustomizationStyles";

type CommonsBackgroundAtmosphereProps = {
  backgroundStyle: unknown;
  accentColor?: string | null;
  variant?: "preview" | "public";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export default function CommonsBackgroundAtmosphere({
  backgroundStyle,
  accentColor,
  variant = "public",
  className = "",
  style,
  children,
}: CommonsBackgroundAtmosphereProps) {
  const option = getCommonsBackgroundStyleOption(backgroundStyle);
  const styleVars = {
    "--commons-accent": safeCommonsAccentColor(accentColor),
    ...style,
  } as CSSProperties;

  return (
    <section
      className={[
        "commons-atmosphere",
        `commons-atmosphere--${variant}`,
        option.className,
        className,
      ].filter(Boolean).join(" ")}
      data-commons-background-style={option.key}
      aria-label={`${option.label} ${variant === "preview" ? "profile preview" : "public profile"} background atmosphere`}
      style={styleVars}
    >
      <div className="commons-atmosphere__base" aria-hidden="true" />
      <div className="commons-atmosphere__texture" aria-hidden="true" />
      <div className="commons-atmosphere__motif" aria-hidden="true" />
      <div className="commons-atmosphere__glow" aria-hidden="true" />
      <div className="commons-atmosphere__content">{children}</div>
    </section>
  );
}
