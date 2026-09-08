import { Link } from "react-router-dom";
import { Palette } from "lucide-react";
import { useAccountDoorways } from "./useAccountDoorways";

export default function CreatorStudioDoorway({ invite = false }: { invite?: boolean }) {
  const access = useAccountDoorways();
  if (access.loading || (!access.creator && !invite)) return null;
  return <section className="section-card split-callout" aria-label="Creator Studio entrance">
    <div><p className="eyebrow"><Palette size={16} aria-hidden="true" /> Create for Elysia</p>
      <h2>{access.creator ? "Your Creator Studio" : "Bring your work to the Marketplace"}</h2>
      <p>{access.creator ? "Your identity, add-ons, review feedback and seller preparation, together in one workspace." : "Start a developer profile in the Forge. Your Creator Studio will gather your own work and Marketplace preparation."}</p>
    </div>
    <Link className="button-link button-link--primary" to={access.creator ? "/marketplace/creator-studio" : "/developer-forge/profile"}>{access.creator ? "Open Creator Studio" : "Start creating"}</Link>
  </section>;
}
