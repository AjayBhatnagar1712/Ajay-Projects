import { useMemo } from "react";
import AddProperty from "@/pages/AddProperty";
import PropertyAddEditFlow from "@/pages/PropertyAddEditFlow";

export default function BrokerPropertyAddRoute() {
  const editId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("edit");
  }, []);

  if (editId) {
    return <PropertyAddEditFlow role="broker" />;
  }

  return <AddProperty />;
}
