import { useEffect } from "react";
import { useLocation } from "wouter";

/** Reset scroll position when marketing routes change (wouter does not do this by default). */
export function useMarketingScrollToTop(): void {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location]);
}
