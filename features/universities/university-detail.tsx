"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  MessageSquareWarning,
  Mic2,
  Phone,
  Plane,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { universitiesService } from "@/services/api";
import {
  formatDate,
  formatDateTime,
  formatNumber,
} from "@/lib/utils";
import type { University, UniversityStatus } from "@/types";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  StatusChip,
} from "@/components/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export interface UniversityDetailProps {
  id: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getUniversityExtras(university: University) {
  return {
    documents: [
      { name: "Institution Profile", status: "Uploaded", date: university.submittedAt },
      { name: "Accreditation Certificate", status: "Uploaded", date: university.submittedAt },
      { name: "Booth Design Layout", status: university.stallNumber ? "Approved" : "Pending", date: university.updatedAt },
      { name: "Insurance & Liability", status: university.status === "Approved" ? "Verified" : "Under Review", date: university.updatedAt },
    ],
    speakers: [
      { name: university.contactPerson, role: "Admissions Head", topic: "Campus Overview & Programs" },
      { name: "Dr. Faculty Representative", role: "Dean of Academics", topic: "Career Pathways & Placements" },
      { name: "Alumni Ambassador", role: "Student Success", topic: "Student Life & Opportunities" },
    ],
    travel: {
      arrivalDate: university.approvedAt ?? university.submittedAt,
      departureDate: university.updatedAt,
      accommodation: university.status === "Approved" ? "Taj Vivanta — 2 rooms" : "Pending confirmation",
      transport: university.stallNumber ? "Airport pickup arranged" : "Not scheduled",
      specialRequests: university.status === "Changes Requested"
        ? "Updated travel itinerary required"
        : "None",
    },
    booth: {
      stallNumber: university.stallNumber ?? "Pending assignment",
      size: "3m × 3m Standard",
      powerRequirement: "2 × 15A sockets",
      branding: university.logo ? "Logo & banner approved" : "Branding assets pending",
      setupTime: "Day before event, 4:00 PM",
    },
  };
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <Skeleton className="h-10 w-full max-w-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}

export function UniversityDetail({ id }: UniversityDetailProps) {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<
    "approve" | "reject" | "changes" | null
  >(null);
  const [changeNotes, setChangeNotes] = useState("");

  const { data: university, isLoading, isError, refetch } = useQuery({
    queryKey: ["universities", id],
    queryFn: () => universitiesService.getById(id),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<University>) =>
      universitiesService.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["universities"] });
      void queryClient.invalidateQueries({ queryKey: ["universities", id] });
    },
  });

  const handleStatusUpdate = async (status: UniversityStatus, notes?: string) => {
    try {
      await updateMutation.mutateAsync({
        status,
        approvedAt: status === "Approved" ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      });

      const messages: Record<UniversityStatus, string> = {
        Approved: `${university?.name} has been approved`,
        Rejected: `${university?.name} has been rejected`,
        "Changes Requested": `Change request sent to ${university?.name}`,
        Pending: "Status updated",
      };

      toast.success(messages[status], {
        description: notes || undefined,
      });
      setPendingAction(null);
      setChangeNotes("");
    } catch {
      toast.error("Failed to update university status");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="University Details" />
        <DetailSkeleton />
      </div>
    );
  }

  if (isError || !university) {
    return (
      <div className="space-y-6">
        <PageHeader title="University Details" />
        <ErrorState
          title="University not found"
          message="We couldn't load this university. It may have been removed or the link is invalid."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const extras = getUniversityExtras(university);
  const canReview =
    university.status === "Pending" || university.status === "Changes Requested";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <PageHeader
        title={university.name}
        description={university.shortName ?? "University partner application"}
        breadcrumbs={[
          { label: "Universities", href: "/universities" },
          { label: university.shortName ?? university.name },
        ]}
        actions={
          canReview ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setPendingAction("changes")}
              >
                <MessageSquareWarning className="h-4 w-4" />
                Request Changes
              </Button>
              <Button
                variant="outline"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => setPendingAction("reject")}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button
                className="gap-2"
                onClick={() => setPendingAction("approve")}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
            </div>
          ) : (
            <StatusChip status={university.status} />
          )
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <Card className="lg:w-80 shrink-0">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-20 w-20">
                {university.logo && (
                  <AvatarImage src={university.logo} alt={university.name} />
                )}
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {getInitials(university.shortName ?? university.name)}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-4 text-lg font-semibold">{university.name}</h2>
              <Badge variant="outline" className="mt-2">
                {university.type}
              </Badge>
              <StatusChip status={university.status} className="mt-3" />

              {university.website && (
                <Button variant="link" size="sm" className="mt-2 gap-1" asChild>
                  <a
                    href={university.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Visit website
                  </a>
                </Button>
              )}
            </div>

            <Separator className="my-5" />

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                {university.city}, {university.state}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" />
                {university.studentCount
                  ? `${formatNumber(university.studentCount)} students`
                  : "Student count N/A"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />
                Booth: {university.stallNumber ?? "Not assigned"}
              </div>
            </div>

            <Separator className="my-5" />

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Contact
              </p>
              <p className="font-medium">{university.contactPerson}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {university.contactEmail}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                {university.contactPhone}
              </p>
            </div>

            <Separator className="my-5" />

            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Submitted {formatDate(university.submittedAt)}</p>
              {university.approvedAt && (
                <p>Approved {formatDate(university.approvedAt)}</p>
              )}
              <p>Updated {formatDateTime(university.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0 flex-1">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="speakers">Speakers</TabsTrigger>
              <TabsTrigger value="travel">Travel</TabsTrigger>
              <TabsTrigger value="booth">Booth Details</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Institution Overview
                  </CardTitle>
                  <CardDescription>
                    Programs and partnership details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Courses Offered
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {university.courses.map((course) => (
                        <Badge key={course} variant="secondary">
                          {course}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Events Participating
                    </p>
                    <p className="mt-1 text-sm">
                      {university.eventIds.length} event
                      {university.eventIds.length !== 1 ? "s" : ""} linked
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-primary" />
                    Submitted Documents
                  </CardTitle>
                  <CardDescription>
                    Required documentation for partnership approval
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {extras.documents.length === 0 ? (
                    <EmptyState
                      title="No documents"
                      description="Documents will appear once the university submits their application."
                      className="py-8"
                    />
                  ) : (
                    <div className="divide-y">
                      {extras.documents.map((doc) => (
                        <div
                          key={doc.name}
                          className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(doc.date)}
                              </p>
                            </div>
                          </div>
                          <StatusChip status={doc.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="speakers" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Mic2 className="h-5 w-5 text-primary" />
                    Speaker Lineup
                  </CardTitle>
                  <CardDescription>
                    Representatives presenting at the event
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {extras.speakers.map((speaker) => (
                      <div
                        key={speaker.name}
                        className="flex items-start gap-4 rounded-xl border bg-muted/30 p-4"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-sm text-primary">
                            {getInitials(speaker.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{speaker.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {speaker.role}
                          </p>
                          <Badge variant="outline" className="mt-2 text-xs">
                            {speaker.topic}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="travel" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Plane className="h-5 w-5 text-primary" />
                    Travel & Accommodation
                  </CardTitle>
                  <CardDescription>
                    Logistics for university representatives
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    {[
                      ["Arrival", formatDate(extras.travel.arrivalDate)],
                      ["Departure", formatDate(extras.travel.departureDate)],
                      ["Accommodation", extras.travel.accommodation],
                      ["Transport", extras.travel.transport],
                      ["Special Requests", extras.travel.specialRequests],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border bg-muted/30 p-4">
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="mt-1 text-sm font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="booth" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5 text-primary" />
                    Booth Details
                  </CardTitle>
                  <CardDescription>
                    Stall assignment and setup requirements
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    {Object.entries(extras.booth).map(([key, value]) => (
                      <div key={key} className="rounded-lg border bg-muted/30 p-4">
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </dt>
                        <dd className="mt-1 text-sm font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ConfirmDialog
        open={pendingAction === "approve"}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title="Approve university"
        description={`Approve ${university.name} as an official Career Uttsav partner? They will be notified and assigned booth privileges.`}
        confirmLabel="Approve"
        onConfirm={() => handleStatusUpdate("Approved")}
        loading={updateMutation.isPending}
      />

      <ConfirmDialog
        open={pendingAction === "reject"}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title="Reject application"
        description={`Reject ${university.name}'s application? This will notify the institution and remove them from the pending queue.`}
        confirmLabel="Reject"
        variant="destructive"
        onConfirm={() => handleStatusUpdate("Rejected")}
        loading={updateMutation.isPending}
      />

      <Dialog
        open={pendingAction === "changes"}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              Send a change request to {university.name}. Specify what needs to be
              updated before approval.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe required changes (documents, booth layout, contact info...)"
            value={changeNotes}
            onChange={(e) => setChangeNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() =>
                void handleStatusUpdate(
                  "Changes Requested",
                  changeNotes || "Changes requested by admin"
                )
              }
            >
              {updateMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-start">
        <Button variant="outline" asChild>
          <Link href="/universities">← Back to Universities</Link>
        </Button>
      </div>
    </motion.div>
  );
}
