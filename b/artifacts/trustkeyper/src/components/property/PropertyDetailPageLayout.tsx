import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export interface PropertyDetailPageLayoutProps {
  backLabel: string;
  onBack: () => void;
  mobileEditLabel?: string;
  onMobileEdit?: () => void;
  summaryCard: ReactNode;
  children: ReactNode;
}

/** Shared property detail page shell — broker baseline grid with sticky summary column. */
export function PropertyDetailPageLayout({
  backLabel,
  onBack,
  mobileEditLabel,
  onMobileEdit,
  summaryCard,
  children,
}: PropertyDetailPageLayoutProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-600 font-medium hover:text-primary transition-colors"
        >
          <ArrowLeft size={15} />
          {backLabel}
        </button>
        {mobileEditLabel && onMobileEdit ? (
          <button
            type="button"
            onClick={onMobileEdit}
            className="text-sm font-medium text-primary hover:underline md:hidden"
          >
            {mobileEditLabel}
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_296px] gap-6 items-start">
        <div className="min-w-0">{children}</div>
        <div className="hidden md:block sticky top-6">{summaryCard}</div>
      </div>
    </div>
  );
}
