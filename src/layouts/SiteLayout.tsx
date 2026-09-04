import { Outlet } from "react-router-dom";
import SiteFooter from "../shared/components/SiteFooter";
import SiteHeader from "../shared/components/SiteHeader";
import RouteEntryManager from "../shared/navigation/RouteEntryManager";
import RouteMetadata from "../shared/navigation/RouteMetadata";

export default function SiteLayout() {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <SiteHeader />
      <RouteEntryManager />
      <RouteMetadata />
      <main id="main-content" className="site-main" tabIndex={-1}>
        <Outlet />
      </main>
      <section className="site-trust-strip">
        Elysia Ecobotics Online is public and cloud-facing. It does not silently access local Elysia memory, private files, credentials, request traces, identity vaults, logs, or machine data.
      </section>
      <SiteFooter />
    </div>
  );
}
