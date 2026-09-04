import { useLocation } from "react-router-dom";
import PageMetadata from "../components/PageMetadata";
import { routeMetadataForPath } from "./routeMetadata";

export default function RouteMetadata() {
  const { pathname } = useLocation();
  return <PageMetadata {...routeMetadataForPath(pathname)} />;
}
