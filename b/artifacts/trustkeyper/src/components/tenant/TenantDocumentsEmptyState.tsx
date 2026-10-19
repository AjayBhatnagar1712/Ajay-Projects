import { FileText } from "lucide-react";

export interface TenantDocumentsEmptyStateProps {
  title: string;
  description: string;
}

export function TenantDocumentsEmptyState({ title, description }: TenantDocumentsEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[rgba(108,132,157,0.18)] bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-primary/[0.09] text-primary flex items-center justify-center">
        <FileText size={24} />
      </div>
      <p className="text-base font-semibold text-[#192839] mb-2">{title}</p>
      <p className="text-sm text-[#40566d] max-w-md mx-auto">{description}</p>
    </div>
  );
}
