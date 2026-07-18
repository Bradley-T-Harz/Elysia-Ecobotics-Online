import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NavLink } from "react-router-dom";

export const navItems = [
  { label: "Home", to: "/" },
  { label: "Archive", to: "/archive" },
  { label: "Marketplace", to: "/marketplace" },
  { label: "Products", to: "/products" },
  { label: "Lab", to: "/lab" },
  { label: "Developer Forge", to: "/developer-forge" },
  { label: "Living Library", to: "/living-library" },
  { label: "Commune", to: "/commune" },
  { label: "Work With", to: "/work-with-elysia-ecobotics" },
  { label: "Commons Circle", to: "/commons-circle" },
  { label: "Artisan Collective", to: "/artisan-collective" },
  { label: "Story", to: "/story" },
  { label: "About", to: "/about" },
  { label: "Mission", to: "/mission" },
  { label: "Support", to: "/support" },
  { label: "Legal", to: "/legal" }
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="site-nav-region">
      <button
        type="button"
        className="site-nav-toggle"
        aria-controls="site-navigation-links"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        <span>{open ? "Close site navigation" : "Explore Elysia"}</span>
      </button>
      <nav
        id="site-navigation-links"
        className="site-nav"
        data-open={open ? "true" : "false"}
        aria-label="Elysia Ecobotics Online pages"
      >
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} onClick={() => setOpen(false)}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
