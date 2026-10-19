import React from "react";
import type { LucideIcon } from "lucide-react";

interface OwnerPageEmptyProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function OwnerPageEmpty({ icon: Icon, title, description, action }: OwnerPageEmptyProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 mb-4">
        <Icon size={24} />
      </div>
      <p className="text-gray-900 font-semibold text-base mb-1">{title}</p>
      {description ? <p className="text-sm text-gray-500 max-w-md">{description}</p> : null}
      {action ? <div className="mt-6 w-full max-w-md sm:max-w-none">{action}</div> : null}
    </div>
  );
}
