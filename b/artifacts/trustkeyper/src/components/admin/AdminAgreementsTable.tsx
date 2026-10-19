/**
 * Admin lease-agreements table — signing queue across all brokers.
 */
import React from "react";
import { Link } from "wouter";
import { AlertCircle, FileText } from "lucide-react";
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
import type { AdminLeaseAgreement } from "@/lib/adminApi";
import { cn } from "@/lib/utils";

export interface AdminAgreementsTableProps {
  agreements: AdminLeaseAgreement[];
  isLoading: boolean;
  isError: boolean;
}

const SKELETON_ROWS = 5;

function formatDate(value: string | null): string {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "—";
  return new Date(timestamp).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function agreementStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "in_review":
      return "In review";
    case "esign_sent":
      return "Sent for signing";
    case "signed":
      return "Signed";
    default:
      return status;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "signed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "esign_sent":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "in_review":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function AgreementsTableSkeleton() {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton className="h-4 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

/**
 * Lists lease agreements for admin signing actions.
 */
export function AdminAgreementsTable({
  agreements,
  isLoading,
  isError,
}: AdminAgreementsTableProps) {
  if (isError) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 p-6 text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="font-medium">Could not load agreements. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  if (!isLoading && agreements.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>No lease agreements yet</EmptyTitle>
          <EmptyDescription>
            Agreements brokers send for signing will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approvals</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <AgreementsTableSkeleton />
            ) : (
              agreements.map((agreement) => (
                <TableRow key={agreement.id}>
                  <TableCell>
                    <Link
                      href={`/admin/agreements/${agreement.id}`}
                      className="font-medium text-sky-800 hover:underline"
                    >
                      {agreement.propertyAddress?.trim() || "Untitled property"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("font-medium", statusBadgeClass(agreement.status))}
                    >
                      {agreementStatusLabel(agreement.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {agreement.approvedCount}/{agreement.partyCount}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(agreement.updatedAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
