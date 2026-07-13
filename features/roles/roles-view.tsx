"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Minus, Shield, Users, X } from "lucide-react";

import { rolesService } from "@/services/api";
import { ROLES } from "@/constants";
import type { Role } from "@/types";
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/components/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const RESOURCES = [
  "events",
  "registrations",
  "universities",
  "partners",
  "blogs",
  "gallery",
  "notifications",
  "users",
  "reports",
  "settings",
  "dashboard",
];

const ACTIONS = ["create", "read", "update", "delete"] as const;

export function RolesView() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesService.getAll(),
  });

  const rolesByName = useMemo(() => {
    const map = new Map<string, Role>();
    data?.forEach((role) => map.set(role.name, role));
    return map;
  }, [data]);

  const orderedRoles = ROLES.map((name) => rolesByName.get(name)).filter(Boolean) as Role[];

  const hasPermission = (role: Role, resource: string, action: string): boolean | "all" => {
    const wildcard = role.permissions.find((p) => p.resource === "*");
    if (wildcard) return "all";
    const perm = role.permissions.find((p) => p.resource === resource);
    if (!perm) return false;
    return perm.actions.includes(action as (typeof ACTIONS)[number]);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Roles & Permissions" />
        <CardSkeleton count={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Roles & Permissions" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  if (!orderedRoles.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Roles & Permissions" />
        <EmptyState icon={Shield} title="No roles configured" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Manage role definitions and access control across the admin platform."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orderedRoles.map((role) => (
          <Card key={role.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{role.name}</CardTitle>
                  <CardDescription className="mt-1">{role.description}</CardDescription>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {role.userCount}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {role.permissions.length} permission group(s)
                {role.permissions.some((p) => p.resource === "*") && " · Full access"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Permission Matrix</CardTitle>
          <CardDescription>
            Resource-level access by role. Super Admin has full access to all resources.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px] sticky left-0 bg-card">Resource</TableHead>
                {orderedRoles.map((role) => (
                  <TableHead key={role.id} className="min-w-[100px] text-center text-xs">
                    {role.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {RESOURCES.map((resource) => (
                <TableRow key={resource}>
                  <TableCell className="sticky left-0 bg-card font-medium capitalize">
                    {resource}
                  </TableCell>
                  {orderedRoles.map((role) => (
                    <TableCell key={`${role.id}-${resource}`} className="text-center">
                      <PermissionCell
                        permissions={ACTIONS.map((a) => hasPermission(role, resource, a))}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PermissionCell({ permissions }: { permissions: (boolean | "all")[] }) {
  if (permissions.every((p) => p === "all")) {
    return <Badge variant="success" className="text-xs">Full</Badge>;
  }

  const granted = permissions.filter((p) => p === true).length;
  if (granted === 0) {
    return <Minus className="mx-auto h-4 w-4 text-muted-foreground" />;
  }

  return (
    <div className="flex justify-center gap-0.5">
      {permissions.map((p, i) =>
        p ? (
          <Check key={ACTIONS[i]} className="h-3.5 w-3.5 text-brand-700" />
        ) : (
          <X key={ACTIONS[i]} className="h-3.5 w-3.5 text-muted-foreground/40" />
        )
      )}
    </div>
  );
}
