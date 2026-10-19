import { Edit, Share2 } from "lucide-react";
import { OwnerFlowButton } from "@/components/owner/OwnerFlowButton";

export interface PropertyDetailActionsProps {
  onShare: () => void;
  onEdit: () => void;
  editLabel?: string;
  showEdit?: boolean;
}

/** Stacked Share + Edit CTAs with equal width via the shared flow button system. */
export function PropertyDetailActions({
  onShare,
  onEdit,
  editLabel = "Edit Details",
  showEdit = true,
}: PropertyDetailActionsProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <OwnerFlowButton type="button" fullWidth onClick={onShare}>
        <Share2 size={15} aria-hidden />
        Share Property
      </OwnerFlowButton>
      {showEdit ? (
        <OwnerFlowButton type="button" fullWidth flowVariant="outline" onClick={onEdit}>
          <Edit size={15} aria-hidden />
          {editLabel}
        </OwnerFlowButton>
      ) : null}
    </div>
  );
}
