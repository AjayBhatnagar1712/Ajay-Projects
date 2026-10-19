/**
 * Floating feedback button — fixed bottom-right, visible on all user-facing pages
 */
import { MessageSquare } from "lucide-react";
import { useLocation } from "wouter";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Props for {@link FeedbackButton}. */
export interface FeedbackButtonProps {
  /** Called when the user clicks the floating button to open the feedback modal. */
  onClick: () => void;
}

/**
 * Fixed circular button that opens the feedback modal.
 * @param props - Component props.
 * @returns Floating feedback trigger, or null on admin routes.
 */
export function FeedbackButton({ onClick }: FeedbackButtonProps) {
  const [location] = useLocation();

  if (location.startsWith("/admin")) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label="Share feedback"
          className="fixed bottom-6 right-6 z-[100] flex h-12 w-12 items-center justify-center rounded-full bg-[#1B4F8A] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4F8A] focus-visible:ring-offset-2"
        >
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">Share feedback</TooltipContent>
    </Tooltip>
  );
}
