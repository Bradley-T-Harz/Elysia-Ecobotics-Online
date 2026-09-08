import { NavLink } from "react-router-dom";
import "../../shared/economics/preparation.css";
import { preparationSections } from "../../shared/economics/preProviderContracts.ts";
import { canVisitStaffRoute, useAccountDoorways } from "../../shared/navigation/useAccountDoorways";
export default function EconomicOperationsNavigation() {
  const access = useAccountDoorways();
  if (!access.economic) return <nav className="button-row" aria-label="Account navigation"><NavLink to="/commons-circle/signals">Back to Signals</NavLink></nav>;
  return <nav className="economic-section-navigation" aria-label="Economic Operations sections"><NavLink to="/commons-circle/signals">Signals</NavLink>{canVisitStaffRoute("/commons-circle/admin-console", access) && <NavLink to="/commons-circle/admin-console">Admin Console</NavLink>}<NavLink to="/admin/economic-operations" end>Existing operations console</NavLink>{preparationSections.filter(([path]) => canVisitStaffRoute(`/admin/economic-operations/${path}`, access)).map(([path, title]) => <NavLink key={path} to={`/admin/economic-operations/${path}`}>{title}</NavLink>)}</nav>;
}
