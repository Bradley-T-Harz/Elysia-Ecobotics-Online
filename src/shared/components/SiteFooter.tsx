import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong>Elysia Ecobotics Online</strong>
        <p>The public commons around Elysia. The private local Elysia core remains local, governed, and user-controlled.</p>
      </div>
      <nav aria-label="Footer links">
        <Link to="/about">About</Link>
        <Link to="/mission">Mission</Link>
        <Link to="/marketplace/trust">Marketplace Trust</Link>
        <Link to="/commons-circle">Commons Circle</Link>
        <Link to="/artisan-collective">Artisan Collective</Link>
        <Link to="/story">Story</Link>
        <Link to="/support">Support Elysia</Link>
        <Link to="/commons-circle/support-billing">Support &amp; Billing</Link>
        <Link to="/legal">Legal</Link>
        <Link to="/legal/privacy-policy">Privacy</Link>
        <Link to="/legal/terms-of-use">Terms</Link>
        <Link to="/legal/support-and-billing-terms">Support &amp; Billing Terms</Link>
        <Link to="/legal/refund-and-cancellation-policy">Refund &amp; Cancellation</Link>
        <Link to="/legal/community-guidelines">Community Guidelines</Link>
        <Link to="/legal/vulnerability-disclosure-policy">Security</Link>
        <Link to="/legal/trademark-notice">Trademark Notice</Link>
      </nav>
      <p>Elysia Ecobotics™ is an EcoSyneva Commons LLC initiative.</p>
      <p>Elysia Ecobotics™ is a trademark of EcoSyneva Commons LLC.</p>
    </footer>
  );
}
