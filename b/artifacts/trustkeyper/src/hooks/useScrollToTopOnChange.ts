import { useEffect } from "react";

/** Scroll viewport (and document) to top when a wizard step changes. */
export function useScrollToTopOnChange(stepKey: number | string): void {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [stepKey]);
}
