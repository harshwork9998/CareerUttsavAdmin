"use client";

import { motion } from "framer-motion";
import { Copy, KeyRound, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  BRAND,
  INK,
  LINE,
  PAPER,
  displayClass,
} from "@/features/dashboard/dashboard-ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FieldError,
  fieldErrorClass,
} from "@/components/shared/form-field-error";

export function ChapterPartnerInvite(props: {
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  login: string;
  temporaryPassword: string;
  onRegeneratePassword: () => void;
  errors: Record<string, string>;
}) {
  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
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
          Partner access
        </p>
        <h3
          className={cn(displayClass, "mt-2 text-2xl font-bold sm:text-3xl")}
          style={{ color: INK.primary }}
        >
          Send them in with a smile
        </h3>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: INK.secondary }}>
          Use <strong>Send email &amp; finish</strong> below to open Gmail with the
          recipient and subject pre-filled. The formatted HTML email is copied to
          your clipboard — click in the message body and press <strong>Ctrl+V</strong> to
          paste it before sending.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: LINE.subtle, background: PAPER.muted }}
          >
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="h-4 w-4" style={{ color: BRAND[700] }} />
              <p className="text-sm font-semibold" style={{ color: INK.primary }}>
                Login credentials
              </p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Login</Label>
                <div className="flex gap-2">
                  <Input value={props.login} readOnly className="bg-white" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyText("Login", props.login)}
                    aria-label="Copy login"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Temporary password</Label>
                <div className="flex gap-2">
                  <Input
                    value={props.temporaryPassword}
                    readOnly
                    className="bg-white font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      copyText("Temporary password", props.temporaryPassword)
                    }
                    aria-label="Copy password"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={props.onRegeneratePassword}
                    aria-label="Regenerate password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
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
                onChange={(e) => props.setInviteEmail(e.target.value)}
                className={fieldErrorClass(props.errors.inviteEmail, "bg-white")}
                aria-invalid={Boolean(props.errors.inviteEmail)}
              />
              <FieldError message={props.errors.inviteEmail} />
            </div>
            <div
              className="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
              style={{ background: BRAND[50], color: INK.secondary }}
            >
              <ShieldCheck
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                style={{ color: BRAND[700] }}
              />
              They’ll see deliverables, seminar seats, and upload logo/banner
              documents from the partner dashboard after login.
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
