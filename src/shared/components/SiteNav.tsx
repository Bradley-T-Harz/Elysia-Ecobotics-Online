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
  { label: "Story", to: "/story" },
  { label: "About", to: "/about" },
  { label: "Mission", to: "/mission" },
  { label: "Legal", to: "/legal" }
];

export default function SiteNav() {
  return (
    <nav className="site-nav" aria-label="Elysia Ecobotics Online pages">
      {navItems.map((item) => <NavLink key={item.to} to={item.to} end={item.to === "/"}>{item.label}</NavLink>)}
    </nav>
  );
}
