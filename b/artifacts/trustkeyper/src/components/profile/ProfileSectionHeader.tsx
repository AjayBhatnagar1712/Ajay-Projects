import React from "react";
import { Check, Pencil, Save, Trash2, X } from "lucide-react";

type ProfileSectionHeaderProps = {
  icon: React.ElementType;
  title: string;
  editing: boolean;
  saved: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
};

export function ProfileSectionHeader({
  icon: Icon,
  title,
  editing,
  saved,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: ProfileSectionHeaderProps) {
  const showActions = onEdit || onSave;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Icon size={15} className="text-primary shrink-0" />
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide truncate">{title}</p>
        {saved && !editing && (
          <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full shrink-0">
            <Check size={10} /> Saved
          </span>
        )}
      </div>
      {showActions && (
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          {editing ? (
            <>
              <button
                type="button"
                onClick={onSave}
                className="flex items-center gap-1 text-xs text-white bg-primary px-3 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors whitespace-nowrap shrink-0"
              >
                <Save size={11} /> Save
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-1 text-xs text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors whitespace-nowrap shrink-0"
              >
                <X size={11} /> Cancel
              </button>
            </>
          ) : (
            <>
              {saved && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <Trash2 size={11} /> Delete
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex items-center gap-1 text-xs text-primary hover:underline font-medium whitespace-nowrap shrink-0"
                >
                  <Pencil size={11} /> Edit
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PaymentMethodOrDivider() {
  return (
    <div className="relative flex items-center justify-center py-3">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">OR</span>
    </div>
  );
}
