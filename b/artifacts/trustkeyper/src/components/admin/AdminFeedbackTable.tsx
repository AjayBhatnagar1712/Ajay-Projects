/**
 * Admin feedback table — ratings, categories, messages, and submission metadata
 */
import React from "react";
import { AlertCircle, MessageSquare, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { AdminFeedback } from "@/lib/adminApi";
import { cn } from "@/lib/utils";

/**
 * Props for {@link AdminFeedbackTable}.
 */
export interface AdminFeedbackTableProps {
  /** Full list of feedback submissions from the admin API. */
  feedback: AdminFeedback[];
  /** When true, renders skeleton placeholder rows. */
  isLoading: boolean;
  /** When true, renders an error state instead of the table. */
  isError: boolean;
}

const SKELETON_ROWS = 5;
const MESSAGE_PREVIEW_LENGTH = 80;

/**
 * Truncates feedback message text for table display.
 * @param message - Full feedback message.
 * @returns Truncated message with ellipsis when longer than 80 characters.
 */
function truncateMessage(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length <= MESSAGE_PREVIEW_LENGTH) return trimmed;
  return `${trimmed.slice(0, MESSAGE_PREVIEW_LENGTH)}…`;
}

/**
 * Formats a phone number for display.
 * @param phone - Raw phone string or null.
 * @returns Formatted phone or em dash when missing.
 */
function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `+91 ${digits}` : phone;
}

/**
 * Formats an ISO timestamp for display.
 * @param createdAt - ISO date string.
 * @returns Locale-formatted date and time.
 */
function formatDate(createdAt: string): string {
  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) return "—";
  return new Date(timestamp).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Returns Tailwind classes for a feedback category badge.
 * @param category - Feedback category value.
 * @returns Badge colour classes.
 */
function categoryBadgeClass(category: string): string {
  switch (category.toLowerCase()) {
    case "bug":
      return "border-red-200 bg-red-50 text-red-700";
    case "feature":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "general":
      return "border-gray-200 bg-gray-50 text-gray-700";
    case "other":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "ux":
      return "border-purple-200 bg-purple-50 text-purple-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

/**
 * Human-readable label for a feedback category.
 * @param category - Feedback category value.
 * @returns Display label.
 */
function categoryLabel(category: string): string {
  switch (category.toLowerCase()) {
    case "bug":
      return "Bug";
    case "feature":
      return "Feature";
    case "general":
      return "General";
    case "other":
      return "Other";
    case "ux":
      return "UX";
    default:
      return category;
  }
}

/**
 * Renders a row of star icons for a 1–5 rating.
 * @param rating - Star rating value.
 * @returns Star rating display.
 */
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={cn(
            "h-4 w-4",
            value <= rating ? "fill-amber-400 text-amber-400" : "fill-none text-gray-300",
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}

function FeedbackTableSkeleton() {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
        <TableRow key={index}>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-md" /></TableCell>
          <TableCell><Skeleton className="h-4 w-full max-w-xs" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

/**
 * Table of all user feedback submissions for the admin portal.
 */
export function AdminFeedbackTable({ feedback, isLoading, isError }: AdminFeedbackTableProps) {
  if (isError) {
    return (
      <Card className="border-red-200 bg-red-50 shadow-sm">
        <CardContent className="flex items-start gap-3 p-6 text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Could not load feedback.</p>
            <p className="mt-1 text-sm text-red-700/80">Please refresh and try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 bg-white shadow-sm">
      <CardContent className="p-0">
        {!isLoading && feedback.length === 0 ? (
          <Empty className="border-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageSquare />
              </EmptyMedia>
              <EmptyTitle>No feedback yet</EmptyTitle>
              <EmptyDescription>
                User feedback from the in-app widget will appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rating</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <FeedbackTableSkeleton />
              ) : (
                feedback.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <StarRating rating={item.rating} />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("font-medium capitalize", categoryBadgeClass(item.category))}
                      >
                        {categoryLabel(item.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md text-gray-700" title={item.message}>
                      {truncateMessage(item.message)}
                    </TableCell>
                    <TableCell className="font-medium text-gray-900">
                      {formatPhone(item.userPhone)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-gray-500">
                      {formatDate(item.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
