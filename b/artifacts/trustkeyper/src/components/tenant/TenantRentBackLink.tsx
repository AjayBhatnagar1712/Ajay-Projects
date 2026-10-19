import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";

export function TenantRentBackLink() {
  return (
    <Link
      href="/tenant/dashboard"
      className="inline-flex items-center gap-2 text-xl text-primary hover:text-primary/90 transition-colors"
    >
      <ChevronLeft size={22} strokeWidth={2} />
      Back to Dashboard
    </Link>
  );
}
