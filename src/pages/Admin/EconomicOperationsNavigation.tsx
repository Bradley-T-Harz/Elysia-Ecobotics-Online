import { NavLink } from "react-router-dom";
import "../../shared/economics/preparation.css";
import { preparationSections } from "../../shared/economics/preProviderContracts.ts";
export default function EconomicOperationsNavigation() {
  return <nav className="economic-section-navigation" aria-label="Economic Operations sections"><NavLink to="/commons-circle/admin-console">Admin Console</NavLink><NavLink to="/admin/economic-operations" end>Existing operations console</NavLink>{preparationSections.map(([path, title]) => <NavLink key={path} to={`/admin/economic-operations/${path}`}>{title}</NavLink>)}</nav>;
}
