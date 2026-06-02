import { useOutletContext } from "react-router-dom";
import type { MarketplaceContext } from "../App";

export function useMarketplaceContext(): MarketplaceContext {
  return useOutletContext<MarketplaceContext>();
}
