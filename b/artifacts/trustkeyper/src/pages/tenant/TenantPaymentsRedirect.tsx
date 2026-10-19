import { useEffect } from "react";
import { useLocation } from "wouter";

/** Legacy workflow links used `/tenant/payments` — redirect to the rent screen. */
export default function TenantPaymentsRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/tenant/rent", { replace: true });
  }, [setLocation]);

  return null;
}
