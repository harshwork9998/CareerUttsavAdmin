"use client";

import { motion } from "framer-motion";
import { Copy, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FieldError,
  fieldErrorClass,
} from "@/components/shared/form-field-error";
import {
  BRAND,
  INK,
  LINE,
  PAPER,
  displayClass,
} from "@/features/dashboard/dashboard-ui";
import { cn } from "@/lib/utils";

export function ChapterPartnerInvite(props: {
  inviteEmail: string;
  setInviteEmail: (value: string) => void;
  login: string;
  setLogin: (value: string) => void;
  temporaryPassword: string;
  accessEnabled: boolean;
  passwordSet: boolean;
  passwordChangeRequired: boolean;
  onGeneratePassword: () => void;
  onSendEmail: () => void;
  onSetAccess: (enabled: boolean) => void;
  pending: boolean;
  errors: Record<string, string>;
  notice?: string;
}) {
  const copyPassword = async () => {
    if (!props.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(props.temporaryPassword);
      toast.success("Temporary password copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border p-6 sm:p-8"
        style={{
          borderColor: LINE.subtle,
          background: `radial-gradient(120% 90% at 0% 0%, ${BRAND[50]} 0%, ${PAPER.surface} 55%)`,
        }}
      >
        <p
          className="text-[11px] font-semibold tracking-[0.18em] uppercase"
          style={{ color: BRAND[700] }}
        >
          Partner Portal Access
        </p>
        <h3
          className={cn(displayClass, "mt-2 text-2xl font-bold sm:text-3xl")}
          style={{ color: INK.primary }}
        >
          Portal login
        </h3>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: INK.secondary }}>
          Generate a temporary password, copy it if you need it, and send the
          access email from here. The current password cannot be shown again
          after you leave this page.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: LINE.subtle, background: PAPER.muted }}
          >
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="h-4 w-4" style={{ color: BRAND[700] }} />
              <p className="text-sm font-semibold" style={{ color: INK.primary }}>
                Login ID
              </p>
            </div>
            <div
              className="space-y-1.5"
              data-field-error={props.errors.login ? "true" : undefined}
            >
              <Label>Login ID</Label>
              <Input
                type="email"
                value={props.login}
                onChange={(event) => props.setLogin(event.target.value)}
                className={fieldErrorClass(props.errors.login, "bg-white")}
                aria-invalid={Boolean(props.errors.login)}
              />
              <FieldError message={props.errors.login} />
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt style={{ color: INK.muted }}>Access</dt>
                <dd className="font-semibold" style={{ color: INK.primary }}>
                  {props.accessEnabled ? "Active" : "Disabled"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt style={{ color: INK.muted }}>Password</dt>
                <dd className="font-semibold" style={{ color: INK.primary }}>
                  {props.passwordSet ? "Set" : "Not set"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt style={{ color: INK.muted }}>First login</dt>
                <dd className="font-semibold" style={{ color: INK.primary }}>
                  {!props.passwordSet
                    ? "—"
                    : props.passwordChangeRequired
                      ? "Password change required"
                      : "Password changed"}
                </dd>
              </div>
            </dl>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: LINE.subtle, background: PAPER.muted }}
          >
            <div className="mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4" style={{ color: BRAND[700] }} />
              <p className="text-sm font-semibold" style={{ color: INK.primary }}>
                Send to
              </p>
            </div>
            <div
              className="space-y-1.5"
              data-field-error={props.errors.inviteEmail ? "true" : undefined}
            >
              <Label>Email</Label>
              <Input
                type="email"
                value={props.inviteEmail}
                onChange={(event) => props.setInviteEmail(event.target.value)}
                className={fieldErrorClass(props.errors.inviteEmail, "bg-white")}
                aria-invalid={Boolean(props.errors.inviteEmail)}
              />
              <FieldError message={props.errors.inviteEmail} />
              <p className="text-xs" style={{ color: INK.muted }}>
                Where the access email is sent. This address is not a second login.
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <Label>Temporary password</Label>
              <Input
                value={props.temporaryPassword}
                readOnly
                className="bg-white font-mono"
                placeholder={
                  props.passwordSet
                    ? "Reset password to generate new credentials."
                    : "Generate a password to show it once."
                }
              />
              <FieldError message={props.errors.password} />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={props.pending}
            onClick={props.onGeneratePassword}
          >
            {props.passwordSet ? "Reset Password" : "Generate Password"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={props.pending || !props.temporaryPassword}
            onClick={() => void copyPassword()}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Password
          </Button>
          <Button
            type="button"
            disabled={props.pending || !props.temporaryPassword || !props.accessEnabled}
            onClick={props.onSendEmail}
          >
            Send Access Email
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={props.pending || !props.accessEnabled}
            onClick={() => props.onSetAccess(false)}
          >
            Disable Access
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={props.pending || props.accessEnabled}
            onClick={() => props.onSetAccess(true)}
          >
            Enable Access
          </Button>
        </div>
        {!props.temporaryPassword ? (
          <p className="mt-3 text-xs" style={{ color: INK.muted }}>
            Reset password to generate new credentials.
          </p>
        ) : null}
        {props.notice ? (
          <p className="mt-3 text-sm" style={{ color: INK.secondary }}>
            {props.notice}
          </p>
        ) : null}
        <div
          className="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
          style={{ background: BRAND[50], color: INK.secondary }}
        >
          <ShieldCheck
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            style={{ color: BRAND[700] }}
          />
          A temporary password must be changed on first login. Disabling access
          signs the partner out.
        </div>
      </motion.section>
    </div>
  );
}
