"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Clock, FileText, History, Send } from "lucide-react";
import { toast } from "sonner";

import { notificationsService } from "@/services/api";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type {
  Notification,
  NotificationAudience,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from "@/types";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FiltersBar,
  PageHeader,
  SearchBar,
  StatusChip,
  TableSkeleton,
  type ColumnDef,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TEMPLATES = [
  {
    id: "tpl-reg",
    name: "Registration Confirmation",
    title: "Registration Confirmed",
    message: "Your registration for {{event}} is confirmed. Registration number: {{regNumber}}.",
    type: "Registration" as NotificationType,
    channel: "Email" as NotificationChannel,
  },
  {
    id: "tpl-reminder",
    name: "Event Reminder",
    title: "Event Reminder — {{event}}",
    message: "Reminder: {{event}} starts tomorrow at {{time}}. Bring your QR code!",
    type: "Event" as NotificationType,
    channel: "SMS" as NotificationChannel,
  },
  {
    id: "tpl-welcome",
    name: "Partner Welcome",
    title: "Welcome aboard, {{partner}}!",
    message: "Your partnership package is confirmed. Account manager: {{manager}}.",
    type: "Success" as NotificationType,
    channel: "Email" as NotificationChannel,
  },
];

const AUDIENCES: NotificationAudience[] = ["All", "Students", "Universities", "Partners", "Admins"];
const CHANNELS: NotificationChannel[] = ["Email", "SMS", "Push", "In-App"];
const TYPES: NotificationType[] = ["Info", "Success", "Warning", "Error", "Registration", "Event", "System"];

export function NotificationsView() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("compose");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NotificationType>("Info");
  const [audience, setAudience] = useState<NotificationAudience>("All");
  const [channel, setChannel] = useState<NotificationChannel>("Email");
  const [scheduledAt, setScheduledAt] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsService.getAll(),
  });

  const sendMutation = useMutation({
    mutationFn: (status: NotificationStatus) =>
      notificationsService.create({
        title,
        message,
        type,
        audience,
        channel,
        status,
        scheduledAt: status === "Scheduled" ? scheduledAt : undefined,
        sentAt: status === "Sent" ? new Date().toISOString() : undefined,
        recipientCount: audience === "All" ? 45000 : 1200,
        createdBy: "usr-003",
      }),
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(status === "Draft" ? "Draft saved" : status === "Scheduled" ? "Notification scheduled" : "Broadcast sent");
      if (status !== "Draft") {
        setTitle("");
        setMessage("");
        setScheduledAt("");
      }
      setTab(status === "Draft" ? "drafts" : "history");
    },
    onError: () => toast.error("Failed to send notification"),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return data.filter((n) => {
      const matchesSearch =
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || n.status === statusFilter;
      const matchesAudience = audienceFilter === "all" || n.audience === audienceFilter;
      return matchesSearch && matchesStatus && matchesAudience;
    });
  }, [data, search, statusFilter, audienceFilter]);

  const history = filtered.filter((n) => n.status === "Sent" || n.status === "Failed" || n.status === "Scheduled");
  const drafts = filtered.filter((n) => n.status === "Draft");

  const applyTemplate = (template: (typeof TEMPLATES)[0]) => {
    setTitle(template.title);
    setMessage(template.message);
    setType(template.type);
    setChannel(template.channel);
    toast.success(`Template "${template.name}" applied`);
  };

  const columns: ColumnDef<Notification>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{row.original.message}</p>
        </div>
      ),
    },
    { accessorKey: "audience", header: "Audience" },
    { accessorKey: "channel", header: "Channel" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      id: "recipients",
      header: "Recipients",
      cell: ({ row }) =>
        row.original.recipientCount ? formatNumber(row.original.recipientCount) : "—",
    },
    {
      id: "date",
      header: "Date",
      cell: ({ row }) => {
        const n = row.original;
        const date = n.sentAt ?? n.scheduledAt ?? n.createdAt;
        return <span className="text-sm">{formatDateTime(date)}</span>;
      },
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Notifications" />
        <TableSkeleton rows={5} columns={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Notifications" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Compose broadcasts, schedule campaigns, and review delivery history."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="compose" className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            History
          </TabsTrigger>
          <TabsTrigger value="drafts" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Drafts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Broadcast Composer</CardTitle>
                <CardDescription>Compose and send messages to targeted audiences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notif-title">Title</Label>
                  <Input
                    id="notif-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Notification title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notif-message">Message</Label>
                  <Textarea
                    id="notif-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Write your message..."
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={type} onValueChange={(v) => setType(v as NotificationType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Audience</Label>
                    <Select value={audience} onValueChange={(v) => setAudience(v as NotificationAudience)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AUDIENCES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <Select value={channel} onValueChange={(v) => setChannel(v as NotificationChannel)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule" className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Schedule (optional)
                  </Label>
                  <Input
                    id="schedule"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="outline"
                    disabled={!title || sendMutation.isPending}
                    onClick={() => sendMutation.mutate("Draft")}
                  >
                    Save Draft
                  </Button>
                  {scheduledAt ? (
                    <Button
                      disabled={!title || !message || sendMutation.isPending}
                      onClick={() => sendMutation.mutate("Scheduled")}
                    >
                      Schedule
                    </Button>
                  ) : (
                    <Button
                      className="gap-2"
                      disabled={!title || !message || sendMutation.isPending}
                      onClick={() => sendMutation.mutate("Sent")}
                    >
                      <Send className="h-4 w-4" />
                      Send Now
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Templates</CardTitle>
                <CardDescription>Quick-start from pre-built message templates.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <p className="text-sm font-medium">{tpl.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{tpl.message}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6 space-y-4">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            audienceFilter={audienceFilter}
            onAudienceChange={setAudienceFilter}
          />
          {history.length === 0 ? (
            <EmptyState icon={Bell} title="No history" description="Sent and scheduled notifications appear here." />
          ) : (
            <DataTable columns={columns} data={history} />
          )}
        </TabsContent>

        <TabsContent value="drafts" className="mt-6 space-y-4">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            statusFilter="Draft"
            onStatusChange={setStatusFilter}
            audienceFilter={audienceFilter}
            onAudienceChange={setAudienceFilter}
            hideStatus
          />
          {drafts.length === 0 ? (
            <EmptyState icon={FileText} title="No drafts" description="Saved drafts appear here." />
          ) : (
            <DataTable columns={columns} data={drafts} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  audienceFilter,
  onAudienceChange,
  hideStatus,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  audienceFilter: string;
  onAudienceChange: (v: string) => void;
  hideStatus?: boolean;
}) {
  return (
    <>
      <SearchBar value={search} onChange={onSearchChange} placeholder="Search notifications..." />
      <FiltersBar
        filters={[
          ...(!hideStatus
            ? [{
                id: "status",
                label: "Status",
                value: statusFilter,
                onChange: onStatusChange,
                options: [
                  { label: "Sent", value: "Sent" },
                  { label: "Scheduled", value: "Scheduled" },
                  { label: "Failed", value: "Failed" },
                ],
              }]
            : []),
          {
            id: "audience",
            label: "Audience",
            value: audienceFilter,
            onChange: onAudienceChange,
            options: AUDIENCES.map((a) => ({ label: a, value: a })),
          },
        ]}
        onClearAll={() => {
          onStatusChange("all");
          onAudienceChange("all");
        }}
      />
    </>
  );
}
