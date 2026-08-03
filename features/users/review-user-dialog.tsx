"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import { ROLE_LABELS, ROLES } from "@/constants";
import type { RoleName, User } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReviewUserDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (user: User, role: RoleName) => Promise<void>;
  onReject: (user: User) => Promise<void>;
  loading?: boolean;
}

export function ReviewUserDialog({
  user,
  open,
  onOpenChange,
  onApprove,
  onReject,
  loading = false,
}: ReviewUserDialogProps) {
  const [role, setRole] = useState<RoleName>("user");

  if (!user) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setRole("user");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review account request</DialogTitle>
          <DialogDescription>
            Approve and assign a role, or reject this signup request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <p className="font-medium">{user.name}</p>
            <p className="text-muted-foreground">{user.email}</p>
            {user.phone ? (
              <p className="text-muted-foreground">{user.phone}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-role">Assign role on approval</Label>
            <Select value={role} onValueChange={(v) => setRole(v as RoleName)}>
              <SelectTrigger id="review-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ROLE_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Superuser gets full access. User gets Registrations, Partners, and
              Seminars only.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1 gap-2"
              disabled={loading}
              onClick={() => onApprove(user, role)}
            >
              <Check className="h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 text-destructive hover:text-destructive"
              disabled={loading}
              onClick={() => onReject(user)}
            >
              <X className="h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
