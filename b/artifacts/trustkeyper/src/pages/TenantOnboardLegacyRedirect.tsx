import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";

/** Legacy invite URLs used `/tenant/onboard/:token` — redirect to the canonical route. */
export default function TenantOnboardLegacyRedirect() {
  const [, params] = useRoute("/tenant/onboard/:token");
  const [, setLocation] = useLocation();
  const token = params?.token ?? "";

  useEffect(() => {
    if (!token) {
      setLocation("/");
      return;
    }
    setLocation(`/onboard/tenant/${token}`);
  }, [token, setLocation]);

  return null;
}
