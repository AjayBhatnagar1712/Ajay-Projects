/**
 * Admin properties table — searchable list of all platform properties
 */
import React, { useMemo, useState } from "react";
import { AlertCircle, Building2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import type { AdminProperty } from "@/lib/adminApi";
import { timeAgo } from "@/lib/tenants";
import { cn } from "@/lib/utils";

/**
 * Props for {@link AdminPropertyTable}.
 */
export interface AdminPropertyTableProps {
  /** Full list of platform properties from the admin API. */
  properties: AdminProperty[];
  /** When true, renders skeleton placeholder rows. */
  isLoading: boolean;
  /** When true, renders an error state instead of the table. */
  isError: boolean;
}

const SKELETON_ROWS = 5;

type StatusTone = "available" | "rented" | "maintenance" | "default";

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `+91 ${digits}` : phone;
}

function formatUpdatedAt(updatedAt: string): string {
  const timestamp = Date.parse(updatedAt);
  if (Number.isNaN(timestamp)) return "—";
  return timeAgo(timestamp);
}

function normalizeStatus(status: string): StatusTone {
  const value = status.trim().toLowerCase();
  if (value === "active" || value === "available") return "available";
  if (value === "rented") return "rented";
  if (value === "maintenance" || value === "draft") return "maintenance";
  return "default";
}

function statusBadgeClass(tone: StatusTone): string {
  switch (tone) {
    case "available":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rented":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "maintenance":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function statusLabel(status: string): string {
  const trimmed = status.trim();
  if (!trimmed) return "Unknown";
  const tone = normalizeStatus(trimmed);
  if (tone === "available" && trimmed.toLowerCase() === "active") return "Available";
  return trimmed;
}

function PropertyTableSkeleton() {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
        <TableRow key={index}>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-md" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

/**
 * Searchable table of all platform properties for the admin portal.
 */
export function AdminPropertyTable({
  properties,
  isLoading,
  isError,
}: AdminPropertyTableProps) {
  const [search, setSearch] = useState("");

  const filteredProperties = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return properties;

    return properties.filter((property) => {
      const address = property.address.toLowerCase();
      const ownerPhone = property.ownerPhone.replace(/\D/g, "");
      const queryDigits = query.replace(/\D/g, "");
      return (
        address.includes(query) ||
        (queryDigits.length > 0 && ownerPhone.includes(queryDigits))
      );
    });
  }, [properties, search]);

  if (isError) {
    return (
      <Card className="border-red-200 bg-red-50 shadow-sm">
        <CardContent className="flex items-start gap-3 p-6 text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Could not load properties.</p>
            <p className="mt-1 text-sm text-red-700/80">Please refresh and try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 bg-white shadow-sm">
      <CardContent className="p-0">
        <div className="border-b border-gray-100 p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="search"
              placeholder="Search by address or owner phone…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              disabled={isLoading}
            />
          </div>
        </div>

        <p className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
          Showing {filteredProperties.length} of {properties.length} properties
        </p>

        {!isLoading && filteredProperties.length === 0 ? (
          <Empty className="border-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2 />
              </EmptyMedia>
              <EmptyTitle>No properties found</EmptyTitle>
              <EmptyDescription>
                {properties.length === 0
                  ? "No properties have been listed yet."
                  : "Try adjusting your search."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Owner Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <PropertyTableSkeleton />
              ) : (
                filteredProperties.map((property, index) => {
                  const tone = normalizeStatus(property.status);
                  return (
                    <TableRow key={`${property.ownerPhone}-${property.address}-${index}`}>
                      <TableCell className="max-w-xs font-medium text-gray-900">
                        {property.address.trim() || "—"}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {property.type.trim() || "—"}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {formatPhone(property.ownerPhone)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("font-medium", statusBadgeClass(tone))}
                        >
                          {statusLabel(property.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatUpdatedAt(property.updatedAt)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
