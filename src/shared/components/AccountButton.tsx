import { Link } from "react-router-dom";
import { CircleUserRound } from "lucide-react";
import { useAuth } from "../auth/useAuth";

export default function AccountButton() {
  const { email, loading, configured } = useAuth();
  const label = loading ? "Checking..." : email ? email : configured ? "Sign in" : "Account";
  return <Link className="account-button" to="/commons-circle"><CircleUserRound size={17} /> {label}</Link>;
}
