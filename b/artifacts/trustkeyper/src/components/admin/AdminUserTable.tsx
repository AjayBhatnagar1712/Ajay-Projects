/**
 * Admin users table — searchable, filterable list of all platform users
 */
import React, { useMemo, useState } from "react";
import { AlertCircle, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { AdminUser } from "@/lib/adminApi";
import { timeAgo } from "@/lib/tenants";
import { cn } from "@/lib/utils";

/** Role filter values for the users table. */
export type AdminUserRoleFilter = "all" | "owner" | "broker";

/**
 * Props for {@link AdminUserTable}.
 */
export interface AdminUserTableProps {
  /** Full list of platform users from the admin API. */
  users: AdminUser[];
  /** When true, renders skeleton placeholder rows. */
  isLoading: boolean;
  /** When true, renders an error state instead of the table. */
  isError: boolean;
}

const SKELETON_ROWS = 5;

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `+91 ${digits}` : phone;
}

function formatLastActive(updatedAt: string): string {
  const timestamp = Date.parse(updatedAt);
  if (Number.isNaN(timestamp)) return "—";
  return timeAgo(timestamp);
}

function roleBadgeClass(role: string): string {
  switch (role.toLowerCase()) {
    case "owner":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "broker":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "admin":
      return "border-purple-200 bg-purple-50 text-purple-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function roleLabel(role: string): string {
  switch (role.toLowerCase()) {
    case "owner":
      return "Owner";
    case "broker":
      return "Broker";
    case "admin":
      return "Admin";
    case "tenant":
      return "Tenant";
    case "manager":
      return "Manager";
    default:
      return role;
  }
}

function UserTableSkeleton() {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
        <TableRow key={index}>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-4 w-36" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-md" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

/**
 * Searchable, filterable table of all platform users for the admin portal.
 */
export function AdminUserTable({ users, isLoading, isError }: AdminUserTableProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminUserRoleFilter>("all");

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesRole =
        roleFilter === "all" || user.role.toLowerCase() === roleFilter;
      if (!matchesRole) return false;
      if (!query) return true;

      const name = user.name.toLowerCase();
      const phone = user.phone.replace(/\D/g, "");
      return name.includes(query) || phone.includes(query.replace(/\D/g, ""));
    });
  }, [users, search, roleFilter]);

  if (isError) {
    return (
      <Card className="border-red-200 bg-red-50 shadow-sm">
        <CardContent className="flex items-start gap-3 p-6 text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Could not load users.</p>
            <p className="mt-1 text-sm text-red-700/80">Please refresh and try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 bg-white shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="search"
              placeholder="Search by phone or name…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              disabled={isLoading}
            />
          </div>
          <Select
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as AdminUserRoleFilter)}
            disabled={isLoading}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="broker">Broker</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
          Showing {filteredUsers.length} of {users.length} users
        </p>

        {!isLoading && filteredUsers.length === 0 ? (
          <Empty className="border-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search />
              </EmptyMedia>
              <EmptyTitle>No users found</EmptyTitle>
              <EmptyDescription>
                {users.length === 0
                  ? "No user profiles have been registered yet."
                  : "Try adjusting your search or role filter."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <UserTableSkeleton />
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={`${user.phone}-${user.role}`}>
                    <TableCell className="font-medium text-gray-900">
                      {formatPhone(user.phone)}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {user.name.trim() || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("font-medium", roleBadgeClass(user.role))}
                      >
                        {roleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatLastActive(user.updatedAt)}
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
