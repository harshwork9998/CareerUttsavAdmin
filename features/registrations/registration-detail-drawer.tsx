"use client";

import {
  Calendar,
  CreditCard,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  QrCode,
  Ticket,
  Trash2,
} from "lucide-react";

import { formatSeminarInterests } from "@/lib/enrich-registration";
import {
  isPartnerRegistrationEntry,
  isSchoolRegistration,
  isStudentAmbassadorRegistration,
  isStudentRegistration,
} from "@/lib/registration-kinds";
import { REGISTRATION_KIND_LABELS } from "@/lib/registration-kinds";
import { getRegistrationDisplayName } from "@/features/registrations/registration-table-config";
import type { Registration } from "@/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { StatusChip } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export interface RegistrationDetailDrawerProps {
  registration: Registration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: () => void;
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function hasQrGenerated(registration: Registration) {
  return (
    isStudentRegistration(registration) &&
    (registration.status === "Confirmed" || registration.status === "Checked In")
  );
}

export function RegistrationDetailDrawer({
  registration,
  open,
  onOpenChange,
  onDelete,
}: RegistrationDetailDrawerProps) {
  if (!registration) return null;

  const displayName = getRegistrationDisplayName(registration);
  const qrGenerated = hasQrGenerated(registration);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed right-0 top-0 left-auto flex h-full w-full max-w-lg translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-l p-0 shadow-2xl data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-xl">
        <DialogHeader className="space-y-0 border-b px-6 py-5 text-left">
          <div className="flex items-start gap-4 pr-8">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-2">
              <DialogTitle className="text-xl">{displayName}</DialogTitle>
              <DialogDescription className="font-mono text-xs">
                {registration.registrationNumber}
              </DialogDescription>
              <p className="text-xs text-muted-foreground">
                {REGISTRATION_KIND_LABELS[registration.kind]}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={registration.status} />
                <StatusChip status={registration.paymentStatus} />
                {qrGenerated && (
                  <Badge variant="success" className="gap-1">
                    <QrCode className="h-3 w-3" />
                    QR Generated
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 px-6 py-5">
            {isStudentRegistration(registration) && (
              <>
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">
                    Contact Information
                  </h3>
                  <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                    <DetailRow icon={Mail} label="Email" value={registration.email} />
                    <DetailRow icon={Phone} label="Student Mobile" value={registration.phone} />
                    <DetailRow
                      icon={Phone}
                      label="Parent Mobile"
                      value={registration.parentPhone ?? "—"}
                    />
                    <DetailRow
                      icon={MapPin}
                      label="Location"
                      value={`${registration.city}, ${registration.state}`}
                    />
                  </div>
                </section>
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">
                    Academic Details
                  </h3>
                  <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                    <DetailRow icon={GraduationCap} label="School/College" value={registration.college} />
                    <DetailRow icon={GraduationCap} label="Class" value={registration.classLabel ?? "—"} />
                    <DetailRow icon={GraduationCap} label="Stream" value={registration.interestedStream ?? "—"} />
                    <DetailRow icon={GraduationCap} label="Board" value={registration.board ?? "—"} />
                    <DetailRow icon={GraduationCap} label="Gender" value={registration.gender ?? "—"} />
                  </div>
                </section>
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Seminars</h3>
                  <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                    {formatSeminarInterests(registration)}
                  </div>
                </section>
              </>
            )}

            {isSchoolRegistration(registration) && (
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">School details</h3>
                <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                  <DetailRow icon={GraduationCap} label="School Name" value={registration.schoolName} />
                  <DetailRow icon={MapPin} label="City" value={registration.schoolCity} />
                  <DetailRow icon={Phone} label="Contact Number" value={registration.schoolContactNumber} />
                  <DetailRow icon={Mail} label="Email" value={registration.schoolContactEmail} />
                </div>
              </section>
            )}

            {isPartnerRegistrationEntry(registration) && (
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Partner details</h3>
                <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                  <DetailRow
                    icon={GraduationCap}
                    label="Institution Name"
                    value={registration.partnerRegInstitutionName}
                  />
                  <DetailRow icon={MapPin} label="City" value={registration.partnerRegCity} />
                  <DetailRow icon={Phone} label="Contact Number" value={registration.partnerRegContactNumber} />
                  <DetailRow icon={Mail} label="Email" value={registration.partnerRegContactEmail} />
                </div>
              </section>
            )}

            {isStudentAmbassadorRegistration(registration) && (
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Ambassador details</h3>
                <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                  <DetailRow icon={GraduationCap} label="Class" value={registration.ambassadorClass} />
                  <DetailRow
                    icon={GraduationCap}
                    label="School/College"
                    value={registration.ambassadorSchoolCollege}
                  />
                  <DetailRow icon={GraduationCap} label="Age" value={registration.ambassadorAge} />
                  <DetailRow icon={Phone} label="Number" value={registration.ambassadorPhone} />
                  <DetailRow icon={Mail} label="Email" value={registration.ambassadorEmail} />
                </div>
              </section>
            )}

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Event & Registration</h3>
              <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                <DetailRow icon={Ticket} label="Event" value={registration.eventTitle} />
                <DetailRow
                  icon={Calendar}
                  label="Registered On"
                  value={formatDateTime(registration.registeredAt)}
                />
                <DetailRow
                  icon={Calendar}
                  label="Last Updated"
                  value={formatDate(registration.updatedAt)}
                />
                {registration.checkInTime && (
                  <DetailRow
                    icon={Calendar}
                    label="Check-in Time"
                    value={formatDateTime(registration.checkInTime)}
                  />
                )}
              </div>
            </section>

            {isStudentRegistration(registration) && (
              <>
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Payment</h3>
                  <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                    <DetailRow
                      icon={CreditCard}
                      label="Payment Status"
                      value={<StatusChip status={registration.paymentStatus} />}
                    />
                    <DetailRow
                      icon={CreditCard}
                      label="Amount"
                      value={
                        registration.amount !== undefined
                          ? formatCurrency(registration.amount)
                          : "—"
                      }
                    />
                  </div>
                </section>
                <Separator />
                <div className="rounded-xl border border-dashed bg-card p-4 text-center">
                  {qrGenerated ? (
                    <div className="space-y-3">
                      <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-xl border-2 border-dashed bg-muted/50">
                        <QrCode className="h-16 w-16 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm font-medium text-foreground">Entry QR Code</p>
                    </div>
                  ) : (
                    <div className="space-y-2 py-4">
                      <QrCode className="mx-auto h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        QR code will be generated once registration is confirmed
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {onDelete ? (
          <div className="border-t px-6 py-4">
            <Button
              type="button"
              variant="destructive"
              className="w-full gap-2 sm:w-auto"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete registration
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated Use RegistrationDetailDrawer */
export const StudentDrawer = RegistrationDetailDrawer;
