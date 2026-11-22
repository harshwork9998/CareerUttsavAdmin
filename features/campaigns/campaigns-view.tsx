"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pause, Play, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CampaignVariableMapping } from "@/lib/server/whatsapp/campaign-variable-mapping";
import type { TemplateCapability } from "@/lib/server/whatsapp/campaign-template-capability";
import type { MetaMessageTemplate } from "@/lib/server/whatsapp/meta-templates";

type CampaignListItem = {
  id: string;
  name: string;
  status: string;
  templateName: string | null;
  createdAt: string;
};

type CampaignCounts = {
  total: number;
  eligible: number;
  skipped: number;
  pending: number;
  accepted: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  unknown: number;
  needsReview: number;
  deliveredOrRead: number;
  acceptedByMeta: number;
  simulated: number;
  invalid: number;
  duplicate: number;
};

type TemplateOption = {
  name: string;
  language: string;
  capability: TemplateCapability;
  template: MetaMessageTemplate;
};

const STEPS = [
  "Choose or create campaign",
  "Upload contacts",
  "Choose template",
  "Review",
  "Send",
] as const;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function CampaignsView() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [mobileColumn, setMobileColumn] = useState("");
  const [uploadHeaders, setUploadHeaders] = useState<string[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [variableMapping, setVariableMapping] = useState<CampaignVariableMapping>({});
  const [consentChecked, setConsentChecked] = useState(false);
  const [testMobile, setTestMobile] = useState("");

  const campaignsQuery = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const response = await fetch("/api/campaigns");
      if (!response.ok) throw new Error("Could not load campaigns.");
      const data = (await response.json()) as { items: CampaignListItem[] };
      return data.items;
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["campaign-templates"],
    queryFn: async () => {
      const response = await fetch("/api/campaigns/templates");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not load templates.");
      }
      return data.templates as TemplateOption[];
    },
    enabled: step >= 2,
  });

  const detailQuery = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}`);
      if (!response.ok) throw new Error("Could not load campaign.");
      return (await response.json()) as {
        campaign: {
          id: string;
          name: string;
          status: string;
          templateName: string | null;
          consentConfirmedAt: string | null;
        };
        counts: CampaignCounts;
      };
    },
    enabled: Boolean(campaignId),
    refetchInterval: (query) =>
      query.state.data?.campaign.status === "RUNNING" ? 3000 : false,
  });

  const createCampaign = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create campaign.");
      return data.campaign as { id: string };
    },
    onSuccess: (campaign) => {
      setCampaignId(campaign.id);
      setStep(1);
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const importContacts = useMutation({
    mutationFn: async () => {
      if (!campaignId || !uploadFile) throw new Error("Upload a file first.");
      const form = new FormData();
      form.append("file", uploadFile);
      if (mobileColumn) form.append("mobileColumn", mobileColumn);
      const response = await fetch(`/api/campaigns/${campaignId}/import`, {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Import failed.");
      return data as {
        acceptedCount: number;
        skippedCount: number;
        headers: string[];
        mobileColumn: string;
      };
    },
    onSuccess: (data) => {
      setUploadHeaders(data.headers);
      setMobileColumn(data.mobileColumn);
      toast.success(
        `${data.acceptedCount} ready to send · ${data.skippedCount} skipped`
      );
      setStep(2);
      void queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
    },
  });

  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!campaignId) throw new Error("No campaign selected.");
      const template = templatesQuery.data?.find(
        (item) => `${item.name}:${item.language}` === selectedTemplateKey
      );
      if (!template) throw new Error("Choose a template.");
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: template.template,
          variableMapping,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save template.");
    },
    onSuccess: () => {
      toast.success("Template saved.");
      setStep(3);
      void queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
    },
  });

  const sendTest = useMutation({
    mutationFn: async () => {
      if (!campaignId) throw new Error("No campaign selected.");
      const response = await fetch(`/api/campaigns/${campaignId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testMobile }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Test failed.");
    },
    onSuccess: () => toast.success("Test message accepted."),
  });

  const startCampaign = useMutation({
    mutationFn: async () => {
      if (!campaignId) throw new Error("No campaign selected.");
      if (consentChecked) {
        const consentResponse = await fetch(`/api/campaigns/${campaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consentConfirmed: true }),
        });
        if (!consentResponse.ok) throw new Error("Could not save consent.");
      }
      const response = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start sending.");
    },
    onSuccess: () => {
      toast.success("Campaign started.");
      setStep(4);
      void queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
    },
  });

  const selectedTemplate = useMemo(
    () =>
      templatesQuery.data?.find(
        (item) => `${item.name}:${item.language}` === selectedTemplateKey
      ),
    [templatesQuery.data, selectedTemplateKey]
  );

  useEffect(() => {
    if (!selectedTemplate) return;
    setVariableMapping({
      header: selectedTemplate.capability.headerVariableSlots.map(() => ({
        kind: "static",
        value: "",
      })),
      body: selectedTemplate.capability.bodyVariableSlots.map(() => ({
        kind: "static",
        value: "",
      })),
    });
  }, [selectedTemplate]);

  const counts = detailQuery.data?.counts;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="WhatsApp Campaigns"
        description="Send approved WhatsApp messages to opted-in contacts. Each campaign is started manually."
      />

      <Card>
        <CardHeader>
          <CardTitle>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Campaign name"
                  value={newCampaignName}
                  onChange={(event) => setNewCampaignName(event.target.value)}
                />
                <Button
                  onClick={() => createCampaign.mutate(newCampaignName)}
                  disabled={!newCampaignName.trim() || createCampaign.isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New campaign
                </Button>
              </div>
              {(campaignsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No campaigns yet. Create one to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Previous campaigns</p>
                  {(campaignsQuery.data ?? []).map((campaign) => (
                    <button
                      key={campaign.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/40"
                      onClick={() => {
                        setCampaignId(campaign.id);
                        setStep(4);
                      }}
                    >
                      <span className="font-medium">{campaign.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {campaign.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 1 && campaignId && (
            <>
              <div className="space-y-2">
                <Label htmlFor="campaign-file">Upload Excel or CSV</Label>
                <Input
                  id="campaign-file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) =>
                    setUploadFile(event.target.files?.[0] ?? null)
                  }
                />
              </div>
              {uploadHeaders.length > 0 && (
                <div className="space-y-2">
                  <Label>Mobile number column</Label>
                  <Select value={mobileColumn} onValueChange={setMobileColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose column" />
                    </SelectTrigger>
                    <SelectContent>
                      {uploadHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                onClick={() => importContacts.mutate()}
                disabled={!uploadFile || importContacts.isPending}
              >
                Continue
              </Button>
            </>
          )}

          {step === 2 && campaignId && (
            <>
              {templatesQuery.isLoading && (
                <p className="text-sm text-muted-foreground">Loading templates…</p>
              )}
              {templatesQuery.error && (
                <p className="text-sm text-destructive">
                  {templatesQuery.error.message}
                </p>
              )}
              {templatesQuery.data && (
                <>
                  <div className="space-y-2">
                    <Label>Approved template</Label>
                    <Select
                      value={selectedTemplateKey}
                      onValueChange={setSelectedTemplateKey}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templatesQuery.data
                          .filter((item) => item.capability.supported)
                          .map((item) => (
                            <SelectItem
                              key={`${item.name}:${item.language}`}
                              value={`${item.name}:${item.language}`}
                            >
                              {item.name} ({item.language})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTemplate?.capability.previewBody && (
                    <p className="rounded-md bg-muted p-3 text-sm">
                      {selectedTemplate.capability.previewBody}
                    </p>
                  )}

                  <VariableFields
                    mapping={variableMapping}
                    headers={uploadHeaders}
                    onChange={setVariableMapping}
                  />

                  <Button
                    onClick={() => saveTemplate.mutate()}
                    disabled={!selectedTemplateKey || saveTemplate.isPending}
                  >
                    Continue
                  </Button>
                </>
              )}
            </>
          )}

          {step === 3 && counts && (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Total rows" value={counts.total} />
                <Stat label="Ready to send" value={counts.pending} />
                <Stat label="Skipped" value={counts.skipped} />
                <Stat
                  label="Invalid / duplicate"
                  value={counts.invalid + counts.duplicate}
                />
              </div>

              <div className="flex items-start gap-2 rounded-md border p-3">
                <Checkbox
                  id="consent"
                  checked={consentChecked}
                  onCheckedChange={(checked) =>
                    setConsentChecked(checked === true)
                  }
                />
                <Label htmlFor="consent" className="text-sm leading-relaxed">
                  I confirm these contacts have agreed to receive this WhatsApp
                  message. This checkbox is not a substitute for valid consent
                  records.
                </Label>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label>Test mobile number</Label>
                  <Input
                    value={testMobile}
                    onChange={(event) => setTestMobile(event.target.value)}
                    placeholder="Your mobile number"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => sendTest.mutate()}
                  disabled={sendTest.isPending}
                >
                  Send test
                </Button>
              </div>

              <Button
                onClick={() => startCampaign.mutate()}
                disabled={!consentChecked || startCampaign.isPending}
              >
                Confirm and send campaign
              </Button>
            </>
          )}

          {step === 4 && campaignId && counts && detailQuery.data && (
            <>
              <p className="text-lg font-semibold">{detailQuery.data.campaign.name}</p>
              <p className="text-sm text-muted-foreground">
                Status: {detailQuery.data.campaign.status}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Accepted by WhatsApp" value={counts.acceptedByMeta} />
                <Stat label="Delivered (incl. read)" value={counts.deliveredOrRead} />
                <Stat label="Read" value={counts.read} />
                <Stat label="Failed" value={counts.failed} />
                <Stat label="Needs review" value={counts.needsReview} />
                <Stat label="Still waiting" value={counts.pending} />
                <Stat label="Delivery unknown" value={counts.unknown} />
                {counts.simulated > 0 && (
                  <Stat label="Simulated (dry run)" value={counts.simulated} />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {detailQuery.data.campaign.status === "RUNNING" && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      void fetch(`/api/campaigns/${campaignId}/pause`, {
                        method: "POST",
                      }).then(() =>
                        queryClient.invalidateQueries({
                          queryKey: ["campaign", campaignId],
                        })
                      )
                    }
                  >
                    <Pause className="mr-2 h-4 w-4" /> Pause
                  </Button>
                )}
                {detailQuery.data.campaign.status === "PAUSED" && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      void fetch(`/api/campaigns/${campaignId}/resume`, {
                        method: "POST",
                      }).then(() =>
                        queryClient.invalidateQueries({
                          queryKey: ["campaign", campaignId],
                        })
                      )
                    }
                  >
                    <Play className="mr-2 h-4 w-4" /> Resume
                  </Button>
                )}
                <Button asChild variant="secondary">
                  <a href={`/api/campaigns/${campaignId}/report`}>
                    <Download className="mr-2 h-4 w-4" /> Download report
                  </a>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VariableFields({
  mapping,
  headers,
  onChange,
}: {
  mapping: CampaignVariableMapping;
  headers: string[];
  onChange: (value: CampaignVariableMapping) => void;
}) {
  const slots = [
    ...(mapping.header ?? []).map((_, index) => ({
      component: "header" as const,
      index,
    })),
    ...(mapping.body ?? []).map((_, index) => ({
      component: "body" as const,
      index,
    })),
  ];

  if (slots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This template has no personalisation fields.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Personalise the message</p>
      {slots.map((slot) => {
        const list =
          slot.component === "header" ? mapping.header! : mapping.body!;
        const source = list[slot.index] ?? { kind: "static", value: "" };
        const label = `${slot.component === "header" ? "Header" : "Message"} field ${slot.index + 1}`;
        return (
          <div
            key={`${slot.component}-${slot.index}`}
            className="grid gap-2 rounded-lg border p-3 md:grid-cols-2"
          >
            <p className="text-sm font-medium md:col-span-2">{label}</p>
            <Select
              value={source.kind}
              onValueChange={(kind) => {
                const copy: CampaignVariableMapping = {
                  header: [...(mapping.header ?? [])],
                  body: [...(mapping.body ?? [])],
                };
                const next =
                  kind === "column"
                    ? { kind: "column" as const, column: headers[0] ?? "" }
                    : { kind: "static" as const, value: "" };
                if (slot.component === "header") copy.header![slot.index] = next;
                else copy.body![slot.index] = next;
                onChange(copy);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="static">Same text for everyone</SelectItem>
                <SelectItem value="column">Use a column from the file</SelectItem>
              </SelectContent>
            </Select>
            {source.kind === "static" ? (
              <Input
                value={source.value ?? ""}
                onChange={(event) => {
                  const copy: CampaignVariableMapping = {
                    header: [...(mapping.header ?? [])],
                    body: [...(mapping.body ?? [])],
                  };
                  const next = { kind: "static" as const, value: event.target.value };
                  if (slot.component === "header") copy.header![slot.index] = next;
                  else copy.body![slot.index] = next;
                  onChange(copy);
                }}
              />
            ) : (
              <Select
                value={source.column ?? ""}
                onValueChange={(column) => {
                  const copy: CampaignVariableMapping = {
                    header: [...(mapping.header ?? [])],
                    body: [...(mapping.body ?? [])],
                  };
                  const next = { kind: "column" as const, column };
                  if (slot.component === "header") copy.header![slot.index] = next;
                  else copy.body![slot.index] = next;
                  onChange(copy);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose column" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map((header) => (
                    <SelectItem key={header} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        );
      })}
    </div>
  );
}