"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Mail, UserCog, UserPlus, UserX } from "lucide-react";
import { toast } from "sonner";

import { usersService } from "@/services/api";
import { ROLES } from "@/constants";
import { formatDateTime } from "@/lib/utils";
import type { RoleName, User, UserStatus } from "@/types";
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FiltersBar,
  PageHeader,
  Pagination,
  SearchBar,
  StatusChip,
  TableSkeleton,
  type ColumnDef,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

const PAGE_SIZE = 8;

const ROLE_ID_BY_NAME: Record<RoleName, string> = {
  "Super Admin": "role-001",
  Admin: "role-002",
  Marketing: "role-003",
  "Content Editor": "role-004",
  Operations: "role-005",
  "Read Only": "role-006",
};

type DialogType = "deactivate" | "reset" | null;

export function UsersList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<RoleName>("Read Only");
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersService.getAll(),
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      usersService.create({
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        roleId: ROLE_ID_BY_NAME[inviteRole],
        status: "Active",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Invitation sent", { description: `Invite email sent to ${inviteEmail}` });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
    },
    onError: () => toast.error("Failed to invite user"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: patch }: { id: string; data: Partial<User> }) =>
      usersService.update(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return data.filter((user) => {
      const matchesSearch =
        !q ||
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [data, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleRoleChange = async (user: User, role: RoleName) => {
    const roleId = ROLE_ID_BY_NAME[role];
    await updateMutation.mutateAsync({ id: user.id, data: { role, roleId } });
    toast.success(`Role updated to ${role}`);
  };

  const handleConfirm = async () => {
    if (!selectedUser || !dialogType) return;
    if (dialogType === "deactivate") {
      const newStatus: UserStatus =
        selectedUser.status === "Active" ? "Inactive" : "Active";
      await updateMutation.mutateAsync({
        id: selectedUser.id,
        data: { status: newStatus },
      });
      toast.success(newStatus === "Inactive" ? "User deactivated" : "User activated");
    } else {
      toast.success("Password reset email sent", {
        description: `Reset link sent to ${selectedUser.email}`,
      });
    }
    setDialogType(null);
    setSelectedUser(null);
  };

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "name",
      header: "User",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => (
        <Select
          value={row.original.role}
          onValueChange={(v) => handleRoleChange(row.original, v as RoleName)}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      id: "lastLogin",
      header: "Last Login",
      cell: ({ row }) =>
        row.original.lastLogin ? (
          <span className="text-sm">{formatDateTime(row.original.lastLogin)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setSelectedUser(row.original);
                setDialogType("reset");
              }}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Reset Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                setSelectedUser(row.original);
                setDialogType("deactivate");
              }}
            >
              <UserX className="mr-2 h-4 w-4" />
              {row.original.status === "Active" ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Users" />
        <TableSkeleton rows={6} columns={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Users" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage admin users and access."
        actions={
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Full Name</Label>
                  <Input
                    id="invite-name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="john@careeruttsav.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as RoleName)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full gap-2"
                  disabled={!inviteEmail || !inviteName || inviteMutation.isPending}
                  onClick={() => inviteMutation.mutate()}
                >
                  <Mail className="h-4 w-4" />
                  Send Invitation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <SearchBar
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Search users..."
      />

      <FiltersBar
        filters={[
          {
            id: "role",
            label: "Role",
            value: roleFilter,
            onChange: (v) => { setRoleFilter(v); setPage(1); },
            options: ROLES.map((r) => ({ label: r, value: r })),
          },
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: (v) => { setStatusFilter(v); setPage(1); },
            options: [
              { label: "Active", value: "Active" },
              { label: "Inactive", value: "Inactive" },
              { label: "Suspended", value: "Suspended" },
            ],
          },
        ]}
        onClearAll={() => {
          setRoleFilter("all");
          setStatusFilter("all");
          setPage(1);
        }}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No users found"
          description="Invite a user or adjust filters."
          action={{ label: "Invite User", onClick: () => setInviteOpen(true) }}
        />
      ) : (
        <>
          <DataTable columns={columns} data={paginated} />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            showPageInfo
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
          />
        </>
      )}

      <ConfirmDialog
        open={dialogType !== null}
        onOpenChange={(open) => !open && setDialogType(null)}
        title={
          dialogType === "reset"
            ? "Reset Password"
            : selectedUser?.status === "Active"
              ? "Deactivate User"
              : "Activate User"
        }
        description={
          dialogType === "reset"
            ? `Send a password reset email to ${selectedUser?.email}?`
            : dialogType === "deactivate" && selectedUser?.status === "Active"
              ? `${selectedUser?.name} will lose access to the admin dashboard.`
              : `${selectedUser?.name} will regain access to the admin dashboard.`
        }
        confirmLabel={dialogType === "reset" ? "Send Reset Email" : "Confirm"}
        variant={dialogType === "deactivate" && selectedUser?.status === "Active" ? "destructive" : "default"}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
