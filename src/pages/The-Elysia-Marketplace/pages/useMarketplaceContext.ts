import { useOutletContext } from "react-router-dom";
import type { MarketplaceContext } from "../MarketplaceProvider";

export function useMarketplaceContext() {
  return useOutletContext<MarketplaceContext>();
}
