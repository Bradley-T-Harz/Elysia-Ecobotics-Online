import { Link } from "react-router-dom";
import { Leaf } from "lucide-react";
import AccountButton from "./AccountButton";
import SiteNav from "./SiteNav";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="brand-row">
        <Link className="site-brand" to="/"><Leaf size={22} /><span>Elysia Ecobotics Online</span></Link>
        <div className="header-actions">
          <AccountButton />
        </div>
      </div>
      <SiteNav />
    </header>
  );
}
