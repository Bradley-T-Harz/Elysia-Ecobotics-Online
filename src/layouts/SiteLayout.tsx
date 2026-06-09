import { Outlet } from "react-router-dom";
import SiteFooter from "../shared/components/SiteFooter";
import SiteHeader from "../shared/components/SiteHeader";

export default function SiteLayout() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="site-main">
        <Outlet />
      </main>
      <section className="site-trust-strip">
        Elysia Ecobotics Online is public and cloud-facing. It does not silently access local Elysia memory, private files, credentials, request traces, identity vaults, logs, or machine data.
      </section>
      <SiteFooter />
    </div>
  );
}
