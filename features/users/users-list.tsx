"use client";



import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { KeyRound, Mail, ShieldAlert, Trash2, UserCog, UserPlus, UserX } from "lucide-react";

import { toast } from "sonner";



import { usersService } from "@/services/api";

import { isSuperuser } from "@/lib/access-control";

import { ROLE_ID_BY_NAME, ROLE_LABELS, ROLES } from "@/constants";

import { formatDateTime } from "@/lib/utils";

import { useAuthStore } from "@/store/auth-store";

import type { RoleName, User, UserStatus } from "@/types";

import {

  ConfirmDialog,

  DataTable,

  EmptyState,

  ErrorState,

  PageHeader,

  StatusChip,

  TableSkeleton,

  type ColumnDef,

} from "@/components/shared";

import { ReviewUserDialog } from "@/features/users/review-user-dialog";

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

import {

  Tooltip,

  TooltipContent,

  TooltipProvider,

  TooltipTrigger,

} from "@/components/ui/tooltip";

import { MoreHorizontal } from "lucide-react";



type DialogType = "deactivate" | "reset" | "delete" | null;



export function UsersList() {

  const queryClient = useQueryClient();

  const currentUser = useAuthStore((s) => s.user);

  const [inviteOpen, setInviteOpen] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");

  const [inviteName, setInviteName] = useState("");

  const [inviteRole, setInviteRole] = useState<RoleName>("user");

  const [dialogType, setDialogType] = useState<DialogType>(null);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [reviewUser, setReviewUser] = useState<User | null>(null);



  const { data, isLoading, isError, refetch } = useQuery({

    queryKey: ["users"],

    queryFn: () => usersService.getAll(),

    enabled: isSuperuser(currentUser),

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



  const reviewMutation = useMutation({

    mutationFn: ({

      id,

      action,

      role,

    }: {

      id: string;

      action: "approve" | "reject";

      role?: RoleName;

    }) => usersService.review(id, { action, role }),

    onSuccess: (result) => {

      queryClient.invalidateQueries({ queryKey: ["users"] });

      toast.success(result.message ?? "Account reviewed");

      setReviewUser(null);

    },

    onError: () => toast.error("Unable to review account"),

  });



  const deleteMutation = useMutation({

    mutationFn: (id: string) => usersService.delete(id),

    onSuccess: (result) => {

      queryClient.invalidateQueries({ queryKey: ["users"] });

      toast.success(result.message ?? "User deleted successfully.");

      setDialogType(null);

      setSelectedUser(null);

    },

    onError: (error: Error) => {

      toast.error(error.message || "Unable to delete user");

    },

  });



  const activeSuperuserCount =

    data?.filter((user) => user.role === "superuser" && user.status === "Active")

      .length ?? 0;



  const canDeleteUser = (user: User) => {

    if (user.id === currentUser?.id) return false;

    if (

      user.role === "superuser" &&

      user.status === "Active" &&

      activeSuperuserCount <= 1

    ) {

      return false;

    }

    return true;

  };



  const getDeleteDisabledReason = (user: User) => {

    if (user.id === currentUser?.id) return null;

    if (

      user.role === "superuser" &&

      user.status === "Active" &&

      activeSuperuserCount <= 1

    ) {

      return "At least one active superuser must remain.";

    }

    return null;

  };



  if (!isSuperuser(currentUser)) {

    return (

      <div className="space-y-6">

        <PageHeader title="Users" />

        <EmptyState

          icon={ShieldAlert}

          title="Access restricted"

          description="Only superusers can manage accounts and approvals."

        />

      </div>

    );

  }



  const users = data ?? [];

  const pendingCount = users.filter((u) => u.status === "Pending Approval").length;



  const handleRoleChange = async (user: User, role: RoleName) => {

    if (user.status !== "Active") return;

    const roleId = ROLE_ID_BY_NAME[role];

    await updateMutation.mutateAsync({ id: user.id, data: { role, roleId } });

    toast.success(`Role updated to ${ROLE_LABELS[role]}`);

  };



  const handleConfirm = async () => {

    if (!selectedUser || !dialogType) return;

    if (dialogType === "delete") {

      await deleteMutation.mutateAsync(selectedUser.id);

      return;

    }

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

      cell: ({ row }) => {

        const user = row.original;

        if (user.status === "Pending Approval") {

          return (

            <span className="text-sm text-muted-foreground">Awaiting assignment</span>

          );

        }

        return (

          <Select

            value={user.role}

            onValueChange={(v) => handleRoleChange(user, v as RoleName)}

            disabled={user.status !== "Active"}

          >

            <SelectTrigger className="h-8 w-[148px]">

              <SelectValue />

            </SelectTrigger>

            <SelectContent>

              {ROLES.map((r) => (

                <SelectItem key={r} value={r}>

                  {ROLE_LABELS[r]}

                </SelectItem>

              ))}

            </SelectContent>

          </Select>

        );

      },

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

      cell: ({ row }) => {

        const user = row.original;

        const deleteDisabledReason = getDeleteDisabledReason(user);

        const showDeleteAction = user.id !== currentUser?.id;



        const deleteMenuItem = (

          <DropdownMenuItem

            className="text-destructive"

            disabled={!canDeleteUser(user)}

            onClick={() => {

              if (!canDeleteUser(user)) return;

              setSelectedUser(user);

              setDialogType("delete");

            }}

          >

            <Trash2 className="mr-2 h-4 w-4" />

            Delete User

          </DropdownMenuItem>

        );



        if (user.status === "Pending Approval") {

          return (

            <DropdownMenu>

              <DropdownMenuTrigger asChild>

                <Button variant="ghost" size="icon" className="h-8 w-8">

                  <MoreHorizontal className="h-4 w-4" />

                </Button>

              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">

                <DropdownMenuItem onClick={() => setReviewUser(user)}>

                  <ShieldAlert className="mr-2 h-4 w-4" />

                  Review

                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {showDeleteAction ? (

                  deleteDisabledReason ? (

                    <TooltipProvider>

                      <Tooltip>

                        <TooltipTrigger asChild>

                          <div>{deleteMenuItem}</div>

                        </TooltipTrigger>

                        <TooltipContent>{deleteDisabledReason}</TooltipContent>

                      </Tooltip>

                    </TooltipProvider>

                  ) : (

                    deleteMenuItem

                  )

                ) : null}

              </DropdownMenuContent>

            </DropdownMenu>

          );

        }



        return (

          <DropdownMenu>

            <DropdownMenuTrigger asChild>

              <Button variant="ghost" size="icon" className="h-8 w-8">

                <MoreHorizontal className="h-4 w-4" />

              </Button>

            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">

              <DropdownMenuItem

                onClick={() => {

                  setSelectedUser(user);

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

                  setSelectedUser(user);

                  setDialogType("deactivate");

                }}

              >

                <UserX className="mr-2 h-4 w-4" />

                {user.status === "Active" ? "Deactivate" : "Activate"}

              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {showDeleteAction ? (

                deleteDisabledReason ? (

                  <TooltipProvider>

                    <Tooltip>

                      <TooltipTrigger asChild>

                        <div>{deleteMenuItem}</div>

                      </TooltipTrigger>

                      <TooltipContent>{deleteDisabledReason}</TooltipContent>

                    </Tooltip>

                  </TooltipProvider>

                ) : (

                  deleteMenuItem

                )

              ) : null}

            </DropdownMenuContent>

          </DropdownMenu>

        );

      },

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

        description="Review signup requests and manage admin access."

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

                      {ROLES.map((r) => (

                        <SelectItem key={r} value={r}>

                          {ROLE_LABELS[r]}

                        </SelectItem>

                      ))}

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



      {pendingCount > 0 ? (

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">

          <span className="font-semibold">{pendingCount}</span>{" "}

          {pendingCount === 1 ? "account" : "accounts"} pending approval. Review

          requests below and assign a role before users can sign in.

        </div>

      ) : null}



      {users.length === 0 ? (

        <EmptyState

          icon={UserCog}

          title="No users found"

          description="Invite a user to get started."

          action={{ label: "Invite User", onClick: () => setInviteOpen(true) }}

        />

      ) : (

        <>

          <DataTable columns={columns} data={users} />

        </>

      )}



      <ReviewUserDialog

        user={reviewUser}

        open={reviewUser !== null}

        onOpenChange={(open) => !open && setReviewUser(null)}

        loading={reviewMutation.isPending}

        onApprove={async (user, role) => {

          await reviewMutation.mutateAsync({

            id: user.id,

            action: "approve",

            role,

          });

        }}

        onReject={async (user) => {

          await reviewMutation.mutateAsync({

            id: user.id,

            action: "reject",

          });

        }}

      />



      <ConfirmDialog

        open={dialogType !== null}

        onOpenChange={(open) => !open && setDialogType(null)}

        title={

          dialogType === "delete"

            ? "Delete User?"

            : dialogType === "reset"

              ? "Reset Password"

              : selectedUser?.status === "Active"

                ? "Deactivate User"

                : "Activate User"

        }

        description={

          dialogType === "delete"

            ? `This will permanently delete ${selectedUser?.name}'s account. They will no longer be able to access Career Uttsav Admin.\n\nThis action cannot be undone.`

            : dialogType === "reset"

              ? `Send a password reset email to ${selectedUser?.email}?`

              : dialogType === "deactivate" && selectedUser?.status === "Active"

                ? `${selectedUser?.name} will lose access to the admin dashboard.`

                : `${selectedUser?.name} will regain access to the admin dashboard.`

        }

        confirmLabel={

          dialogType === "delete"

            ? "Delete User"

            : dialogType === "reset"

              ? "Send Reset Email"

              : "Confirm"

        }

        variant={

          dialogType === "delete" ||

          (dialogType === "deactivate" && selectedUser?.status === "Active")

            ? "destructive"

            : "default"

        }

        loading={deleteMutation.isPending}

        onConfirm={handleConfirm}

      />

    </div>

  );

}


