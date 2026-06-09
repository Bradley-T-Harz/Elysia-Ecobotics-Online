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
        <Link to="/trust">Marketplace Trust</Link>
        <Link to="/commons-circle">Commons Circle</Link>
      </nav>
      <p>Elysia Ecobotics™ is an EcoSyneva Commons LLC initiative.</p>
      <p>Elysia Ecobotics™ is a trademark of EcoSyneva Commons LLC.</p>
    </footer>
  );
}
