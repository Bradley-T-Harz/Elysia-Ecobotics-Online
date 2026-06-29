import type { ReactNode } from "react";
import {
  getCommonsProfileLayoutOption,
  normalizeCommonsProfileLayout,
} from "../commonsProfileLayouts";

type CommonsProfileLayoutFrameProps = {
  profileLayout: unknown;
  variant?: "preview" | "public";
  className?: string;
  children: ReactNode;
};

export function CommonsProfileLayoutFrame({
  profileLayout,
  variant = "public",
  className = "",
  children,
}: CommonsProfileLayoutFrameProps) {
  const normalizedLayout = normalizeCommonsProfileLayout(profileLayout);
  const option = getCommonsProfileLayoutOption(normalizedLayout);

  return (
    <div
      className={[
        "commons-profile-layout",
        `commons-profile-layout--${variant}`,
        option.className,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-commons-profile-layout={option.key}
    >
      {children}
    </div>
  );
}

export default CommonsProfileLayoutFrame;
