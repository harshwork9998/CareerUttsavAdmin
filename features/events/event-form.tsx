"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { motion } from "framer-motion";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { eventsService } from "@/services/api";
import { EVENT_STATUSES } from "@/constants";
import type { Event, EventStatus } from "@/types";
import { ErrorState, PageHeader, RichTextEditor } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const eventFormSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    slug: z.string().min(3, "Slug must be at least 3 characters"),
    description: z.string().min(20, "Description must be at least 20 characters"),
    shortDescription: z.string().optional(),
    status: z.enum(EVENT_STATUSES as unknown as [EventStatus, ...EventStatus[]]),
    venue: z.string().min(2, "Venue is required"),
    address: z.string().min(5, "Address is required"),
    city: z.string().min(2, "City is required"),
    state: z.string().min(2, "State is required"),
    pincode: z
      .string()
      .regex(/^\d{6}$/, "Pincode must be a 6-digit number"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    registrationDeadline: z.string().min(1, "Registration deadline is required"),
    maxCapacity: z.number().min(1, "Capacity must be at least 1"),
    isFeatured: z.boolean(),
    tags: z.string().optional(),
  })
  .refine(
    (data) => new Date(data.endDate) >= new Date(data.startDate),
    { message: "End date must be after start date", path: ["endDate"] }
  )
  .refine(
    (data) =>
      new Date(data.registrationDeadline) <= new Date(data.startDate),
    {
      message: "Registration deadline must be before start date",
      path: ["registrationDeadline"],
    }
  );

type EventFormValues = z.infer<typeof eventFormSchema>;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function toDatetimeLocal(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

const defaultValues: EventFormValues = {
  title: "",
  slug: "",
  description: "",
  shortDescription: "",
  status: "Draft",
  venue: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  startDate: "",
  endDate: "",
  registrationDeadline: "",
  maxCapacity: 5000,
  isFeatured: false,
  tags: "",
};

export interface EventFormProps {
  eventId?: string;
}

export function EventForm({ eventId }: EventFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = Boolean(eventId);

  const eventQuery = useQuery({
    queryKey: ["events", eventId],
    queryFn: () => eventsService.getById(eventId!),
    enabled: isEditing,
  });

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues,
  });

  const title = form.watch("title");

  useEffect(() => {
    if (!isEditing && title) {
      form.setValue("slug", slugify(title), { shouldValidate: true });
    }
  }, [title, isEditing, form]);

  useEffect(() => {
    if (eventQuery.data) {
      const event = eventQuery.data;
      form.reset({
        title: event.title,
        slug: event.slug,
        description: event.description,
        shortDescription: event.shortDescription ?? "",
        status: event.status,
        venue: event.venue,
        address: event.address,
        city: event.city,
        state: event.state,
        pincode: event.pincode,
        startDate: toDatetimeLocal(event.startDate),
        endDate: toDatetimeLocal(event.endDate),
        registrationDeadline: toDatetimeLocal(event.registrationDeadline),
        maxCapacity: event.maxCapacity,
        isFeatured: event.isFeatured,
        tags: event.tags.join(", "),
      });
    }
  }, [eventQuery.data, form]);

  const createMutation = useMutation({
    mutationFn: (values: EventFormValues) => {
      const payload: Omit<Event, "id" | "createdAt" | "updatedAt"> = {
        title: values.title,
        slug: values.slug,
        description: values.description,
        shortDescription: values.shortDescription,
        status: values.status,
        venue: values.venue,
        address: values.address,
        city: values.city,
        state: values.state,
        pincode: values.pincode,
        startDate: fromDatetimeLocal(values.startDate),
        endDate: fromDatetimeLocal(values.endDate),
        startTime: "09:00",
        endTime: "18:00",
        hallCount: 1,
        seminars: [],
        registrationDeadline: fromDatetimeLocal(values.registrationDeadline),
        maxCapacity: values.maxCapacity,
        registrationCount: 0,
        checkInCount: 0,
        isFeatured: values.isFeatured,
        tags: values.tags
          ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
        createdBy: "usr-001",
      };
      return eventsService.create(payload);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<Event[]>(["events"], (old) =>
        old ? [created, ...old] : [created]
      );
      toast.success("Event created successfully");
      router.push(`/events/${created.id}`);
    },
    onError: () => toast.error("Failed to create event"),
  });

  const updateMutation = useMutation({
    mutationFn: (values: EventFormValues) =>
      eventsService.update(eventId!, {
        title: values.title,
        slug: values.slug,
        description: values.description,
        shortDescription: values.shortDescription,
        status: values.status,
        venue: values.venue,
        address: values.address,
        city: values.city,
        state: values.state,
        pincode: values.pincode,
        startDate: fromDatetimeLocal(values.startDate),
        endDate: fromDatetimeLocal(values.endDate),
        registrationDeadline: fromDatetimeLocal(values.registrationDeadline),
        maxCapacity: values.maxCapacity,
        isFeatured: values.isFeatured,
        tags: values.tags
          ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
      }),
    onSuccess: (updated) => {
      if (!updated) {
        toast.error("Failed to update event");
        return;
      }
      queryClient.setQueryData<Event[]>(["events"], (old) =>
        old?.map((e) => (e.id === updated.id ? updated : e))
      );
      queryClient.setQueryData(["events", eventId], updated);
      toast.success("Event updated successfully");
      router.push(`/events/${updated.id}`);
    },
    onError: () => toast.error("Failed to update event"),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: EventFormValues) => {
    if (isEditing) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  if (isEditing && eventQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (isEditing && (eventQuery.isError || !eventQuery.data)) {
    return (
      <ErrorState
        title="Event not found"
        message="The event you're trying to edit doesn't exist or couldn't be loaded."
        onRetry={() => void eventQuery.refetch()}
      />
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
    >
      <PageHeader
        title={isEditing ? "Edit Event" : "Create Event"}
        description={
          isEditing
            ? `Update details for ${eventQuery.data?.title}`
            : "Set up a new Career Uttsav event"
        }
        breadcrumbs={[
          { label: "Events", href: "/events" },
          isEditing && eventQuery.data
            ? { label: eventQuery.data.title, href: `/events/${eventId}` }
            : { label: "New", href: "/events" },
          { label: isEditing ? "Edit" : "Create" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Event title, description, and metadata</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input id="title" {...form.register("title")} placeholder="Career Uttsav Bengaluru 2026" />
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug *</Label>
                <Input id="slug" {...form.register("slug")} placeholder="career-uttsav-bengaluru-2026" />
                {form.formState.errors.slug && (
                  <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="shortDescription">Short Description</Label>
                <Textarea
                  id="shortDescription"
                  {...form.register("shortDescription")}
                  placeholder="Brief summary for listings and cards"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Full Description *</Label>
                <Controller
                  name="description"
                  control={form.control}
                  render={({ field }) => (
                    <RichTextEditor
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Detailed event description..."
                      minHeight={160}
                    />
                  )}
                />
                {form.formState.errors.description && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.description.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  {...form.register("tags")}
                  placeholder="Engineering, MBA, Study Abroad (comma-separated)"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Venue & Location</CardTitle>
              <CardDescription>Where the event will take place</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="venue">Venue *</Label>
                <Input id="venue" {...form.register("venue")} placeholder="Palace Grounds" />
                {form.formState.errors.venue && (
                  <p className="text-xs text-destructive">{form.formState.errors.venue.message}</p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Address *</Label>
                <Textarea id="address" {...form.register("address")} rows={2} />
                {form.formState.errors.address && (
                  <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input id="city" {...form.register("city")} />
                {form.formState.errors.city && (
                  <p className="text-xs text-destructive">{form.formState.errors.city.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Input id="state" {...form.register("state")} />
                {form.formState.errors.state && (
                  <p className="text-xs text-destructive">{form.formState.errors.state.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode *</Label>
                <Input id="pincode" {...form.register("pincode")} placeholder="560001" />
                {form.formState.errors.pincode && (
                  <p className="text-xs text-destructive">{form.formState.errors.pincode.message}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule & Capacity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date & Time *</Label>
                <Input id="startDate" type="datetime-local" {...form.register("startDate")} />
                {form.formState.errors.startDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date & Time *</Label>
                <Input id="endDate" type="datetime-local" {...form.register("endDate")} />
                {form.formState.errors.endDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.endDate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="registrationDeadline">Registration Deadline *</Label>
                <Input
                  id="registrationDeadline"
                  type="datetime-local"
                  {...form.register("registrationDeadline")}
                />
                {form.formState.errors.registrationDeadline && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.registrationDeadline.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxCapacity">Max Capacity *</Label>
                <Input
                  id="maxCapacity"
                  type="number"
                  min={1}
                  {...form.register("maxCapacity", { valueAsNumber: true })}
                />
                {form.formState.errors.maxCapacity && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.maxCapacity.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Controller
                  name="status"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="isFeatured">Featured Event</Label>
                  <p className="text-xs text-muted-foreground">
                    Highlight on homepage and listings
                  </p>
                </div>
                <Controller
                  name="isFeatured"
                  control={form.control}
                  render={({ field }) => (
                    <Switch
                      id="isFeatured"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isEditing ? "Save Changes" : "Create Event"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </motion.form>
  );
}
