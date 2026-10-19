import { useEffect } from "react";
import { useLocation } from "wouter";

/** Legacy route — unified Add Tenant hub at /broker/tenants/add */
export default function BrokerTenantInvite() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/broker/tenants/add");
  }, [setLocation]);

  return null;
}
