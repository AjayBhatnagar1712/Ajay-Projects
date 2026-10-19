import { Building2 } from "lucide-react";

export interface TenantDocumentsPropertyCardProps {
  propertyTitle: string;
  propertySubtitle?: string;
  loading?: boolean;
}

export function TenantDocumentsPropertyCard({
  propertyTitle,
  propertySubtitle,
  loading,
}: TenantDocumentsPropertyCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-[0px_12px_32px_-8px_rgba(25,27,35,0.06)] animate-pulse">
        <div className="flex gap-3 items-center">
          <div className="w-16 h-16 rounded-xl bg-gray-100" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-gray-100 rounded w-2/3" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-[0px_12px_32px_-8px_rgba(25,27,35,0.06)]">
      <div className="flex gap-3 items-start">
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center bg-gradient-to-br from-[#E8F4FC] to-[#D4EBE4]">
          <Building2 size={28} className="text-primary/35" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-medium text-[#14181f] leading-6">{propertyTitle}</p>
          {propertySubtitle ? (
            <p className="text-sm text-[#6b7280] tracking-wide mt-1">{propertySubtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
