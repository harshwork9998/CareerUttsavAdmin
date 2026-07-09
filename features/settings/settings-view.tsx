"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { settingsService } from "@/services/api";
import type { Settings } from "@/types";
import {
  CardSkeleton,
  ErrorState,
  PageHeader,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

const MESSAGE_TEMPLATES = [
  { id: "reg-confirm", name: "Registration Confirmation", subject: "Your registration is confirmed", body: "Hi {{name}}, your registration for {{event}} is confirmed." },
  { id: "event-reminder", name: "Event Reminder", subject: "Reminder: {{event}} tomorrow", body: "Don't forget! {{event}} starts at {{time}}." },
  { id: "uni-approved", name: "University Approved", subject: "Application approved", body: "Congratulations! {{university}} is approved for {{event}}." },
];

export function SettingsView() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(MESSAGE_TEMPLATES[0].id);
  const [templateSubject, setTemplateSubject] = useState(MESSAGE_TEMPLATES[0].subject);
  const [templateBody, setTemplateBody] = useState(MESSAGE_TEMPLATES[0].body);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsService.get(),
  });

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => settingsService.update(settings!),
    onSuccess: (updated) => {
      queryClient.setQueryData(["settings"], updated);
      toast.success("Settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const updateGeneral = (patch: Partial<Settings["general"]>) => {
    setSettings((prev) =>
      prev ? { ...prev, general: { ...prev.general, ...patch } } : prev
    );
  };

  const updateNotifications = (patch: Partial<Settings["notifications"]>) => {
    setSettings((prev) =>
      prev ? { ...prev, notifications: { ...prev.notifications, ...patch } } : prev
    );
  };

  const updateAppearance = (patch: Partial<Settings["appearance"]>) => {
    setSettings((prev) =>
      prev ? { ...prev, appearance: { ...prev.appearance, ...patch } } : prev
    );
  };

  const updateIntegrations = (patch: Partial<Settings["integrations"]>) => {
    setSettings((prev) =>
      prev ? { ...prev, integrations: { ...prev.integrations, ...patch } } : prev
    );
  };

  const handleTemplateSelect = (id: string) => {
    const tpl = MESSAGE_TEMPLATES.find((t) => t.id === id);
    if (tpl) {
      setSelectedTemplate(id);
      setTemplateSubject(tpl.subject);
      setTemplateBody(tpl.body);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" />
        <CardSkeleton count={2} />
      </div>
    );
  }

  if (isError || !settings) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure organization, branding, messaging, and platform defaults."
        actions={
          <Button
            className="gap-2"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        }
      />

      <Tabs defaultValue="organization">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="templates">Message Templates</TabsTrigger>
          <TabsTrigger value="email">Email Settings</TabsTrigger>
          <TabsTrigger value="notifications">Notification Preferences</TabsTrigger>
          <TabsTrigger value="events">Event Defaults</TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>General organization and contact information.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 max-w-3xl">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="siteName">Site Name</Label>
                <Input
                  id="siteName"
                  value={settings.general.siteName}
                  onChange={(e) => updateGeneral({ siteName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={settings.general.contactEmail}
                  onChange={(e) => updateGeneral({ contactEmail: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  value={settings.general.contactPhone}
                  onChange={(e) => updateGeneral({ contactPhone: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={settings.general.address}
                  onChange={(e) => updateGeneral({ address: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={settings.general.timezone}
                  onValueChange={(v) => updateGeneral({ timezone: v })}
                >
                  <SelectTrigger id="timezone"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Colors, logo, and visual identity.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 max-w-3xl">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={settings.appearance.primaryColor}
                    onChange={(e) => updateAppearance({ primaryColor: e.target.value })}
                    className="h-10 w-14 p-1"
                  />
                  <Input
                    value={settings.appearance.primaryColor}
                    onChange={(e) => updateAppearance({ primaryColor: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={settings.appearance.secondaryColor}
                    onChange={(e) => updateAppearance({ secondaryColor: e.target.value })}
                    className="h-10 w-14 p-1"
                  />
                  <Input
                    value={settings.appearance.secondaryColor}
                    onChange={(e) => updateAppearance({ secondaryColor: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  value={settings.appearance.logoUrl ?? ""}
                  onChange={(e) => updateAppearance({ logoUrl: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="faviconUrl">Favicon URL</Label>
                <Input
                  id="faviconUrl"
                  value={settings.appearance.faviconUrl ?? ""}
                  onChange={(e) => updateAppearance({ faviconUrl: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Message Templates</CardTitle>
              <CardDescription>Email and SMS templates with variable placeholders.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-3xl">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESSAGE_TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-subject">Subject</Label>
                <Input
                  id="tpl-subject"
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-body">Body</Label>
                <Textarea
                  id="tpl-body"
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  rows={6}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Settings</CardTitle>
              <CardDescription>Email delivery and integration configuration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-3xl">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Mailchimp Integration</p>
                  <p className="text-sm text-muted-foreground">Sync contacts for marketing campaigns</p>
                </div>
                <Switch
                  checked={Boolean(settings.integrations.mailchimpListId)}
                  onCheckedChange={(v) =>
                    updateIntegrations({
                      mailchimpListId: v ? "a1b2c3d4e5" : undefined,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mailchimp">Mailchimp List ID</Label>
                <Input
                  id="mailchimp"
                  value={settings.integrations.mailchimpListId ?? ""}
                  onChange={(e) => updateIntegrations({ mailchimpListId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ga">Google Analytics ID</Label>
                <Input
                  id="ga"
                  value={settings.integrations.googleAnalyticsId ?? ""}
                  onChange={(e) => updateIntegrations({ googleAnalyticsId: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Control which notification channels and types are enabled.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-3xl">
              {[
                { key: "emailEnabled" as const, label: "Email Notifications", desc: "Send transactional emails" },
                { key: "smsEnabled" as const, label: "SMS Notifications", desc: "Send SMS alerts and reminders" },
                { key: "pushEnabled" as const, label: "Push Notifications", desc: "Mobile and web push" },
                { key: "registrationConfirmation" as const, label: "Registration Confirmations", desc: "Auto-send on registration" },
                { key: "eventReminders" as const, label: "Event Reminders", desc: "Pre-event reminder messages" },
                { key: "marketingEmails" as const, label: "Marketing Emails", desc: "Promotional campaigns" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={settings.notifications[item.key]}
                    onCheckedChange={(v) => updateNotifications({ [item.key]: v })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Event Defaults</CardTitle>
              <CardDescription>Default values applied when creating new events.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 max-w-3xl">
              <div className="space-y-2">
                <Label htmlFor="defaultCity">Default City</Label>
                <Input
                  id="defaultCity"
                  value={settings.general.defaultCity}
                  onChange={(e) => updateGeneral({ defaultCity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registrationFee">Default Registration Fee (₹)</Label>
                <Input
                  id="registrationFee"
                  type="number"
                  value={settings.general.registrationFee}
                  onChange={(e) =>
                    updateGeneral({ registrationFee: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4 sm:col-span-2">
                <div>
                  <p className="font-medium">Razorpay Payments</p>
                  <p className="text-sm text-muted-foreground">Enable online payment collection</p>
                </div>
                <Switch
                  checked={settings.integrations.razorpayEnabled}
                  onCheckedChange={(v) => updateIntegrations({ razorpayEnabled: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4 sm:col-span-2">
                <div>
                  <p className="font-medium">WhatsApp Notifications</p>
                  <p className="text-sm text-muted-foreground">Send updates via WhatsApp Business API</p>
                </div>
                <Switch
                  checked={settings.integrations.whatsappEnabled}
                  onCheckedChange={(v) => updateIntegrations({ whatsappEnabled: v })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
