"use client";

import { useMemo } from "react";
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
import { buildPartnerWelcomeEmail } from "@/lib/partner-invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ChapterPartnerInvite(props: {
  partnerName: string;
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  login: string;
  temporaryPassword: string;
  onRegeneratePassword: () => void;
  hasSeminarSlots?: boolean;
  errors: Record<string, string>;
}) {
  const emailPreview = useMemo(
    () =>
      buildPartnerWelcomeEmail({
        partnerName: props.partnerName,
        login: props.login,
        temporaryPassword: props.temporaryPassword,
        hasSeminarSlots: props.hasSeminarSlots,
      }),
    [
      props.partnerName,
      props.login,
      props.temporaryPassword,
      props.hasSeminarSlots,
    ]
  );

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
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={props.inviteEmail}
                onChange={(e) => props.setInviteEmail(e.target.value)}
                className="bg-white"
              />
              {props.errors.inviteEmail ? (
                <p className="text-xs text-destructive">
                  {props.errors.inviteEmail}
                </p>
              ) : null}
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

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-[28px] border p-5 sm:p-6"
        style={{ borderColor: LINE.subtle, background: PAPER.surface }}
      >
        <p
          className="text-[11px] font-semibold tracking-[0.16em] uppercase"
          style={{ color: BRAND[700] }}
        >
          Email preview
        </p>
        <Textarea
          readOnly
          rows={28}
          value={emailPreview.body}
          className="mt-4 min-h-[32rem] resize-none bg-[color:var(--muted,#F8FAFC)] font-mono text-sm leading-relaxed"
        />
      </motion.section>
    </div>
  );
}
