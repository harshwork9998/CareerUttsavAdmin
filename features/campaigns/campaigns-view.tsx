"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MoreHorizontal, Pause, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import type {
  CampaignButtonUrlMapping,
  CampaignVariableMapping,
} from "@/lib/server/whatsapp/campaign-variable-mapping";
import {
  assessTemplateCapability,
  type TemplateCapability,
  type TemplateUrlButtonSlot,
} from "@/lib/server/whatsapp/campaign-template-capability";
import type { MetaMessageTemplate } from "@/lib/server/whatsapp/meta-templates";
import { isDraftSetupStep } from "@/lib/server/whatsapp/campaign-wizard-resume";
import {
  type CampaignDetailPayload,
  useCampaignResume,
} from "@/features/campaigns/use-campaign-resume";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const {
    step,
    campaignId,
    setCampaignId,
    clearCampaign,
    uploadHeaders,
    setUploadHeaders,
    selectedTemplateKey,
    variableMapping,
    setVariableMapping,
    consentChecked,
    setConsentChecked,
    applyCampaignDetail,
    goToStep,
    onTemplateSelected,
    allowsSetupNavigation,
    assessSendReadiness,
  } = useCampaignResume();
  const [newCampaignName, setNewCampaignName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [mobileColumn, setMobileColumn] = useState("");
  const [testMobile, setTestMobile] = useState("");
  const [headerPdfFile, setHeaderPdfFile] = useState<File | null>(null);
  const [headerMediaIdInput, setHeaderMediaIdInput] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CampaignListItem | null>(null);

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
      return (await response.json()) as CampaignDetailPayload;
    },
    enabled: Boolean(campaignId),
    refetchInterval: (query) =>
      query.state.data?.campaign.status === "RUNNING" ? 3000 : false,
  });

  useEffect(() => {
    if (detailQuery.data) {
      applyCampaignDetail(detailQuery.data);
    }
  }, [detailQuery.data, applyCampaignDetail]);

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
      goToStep(1);
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
      goToStep(2);
      void queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
    },
  });

  const uploadHeaderPdf = useMutation({
    mutationFn: async () => {
      if (!campaignId) throw new Error("No campaign selected.");
      const template = templatesQuery.data?.find(
        (item) => `${item.name}:${item.language}` === selectedTemplateKey
      );
      if (!template) throw new Error("Choose a template first.");

      const form = new FormData();
      form.append("template", JSON.stringify(template.template));

      if (headerMediaIdInput.trim()) {
        form.append("mediaId", headerMediaIdInput.trim());
      } else if (headerPdfFile) {
        form.append("file", headerPdfFile);
      } else {
        throw new Error("Choose a PDF file or paste a Meta media ID.");
      }

      const response = await fetch(`/api/campaigns/${campaignId}/header-document`, {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        error?: string;
        mediaId?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Could not attach PDF.");
      return data.mediaId ?? "";
    },
    onSuccess: (mediaId) => {
      setVariableMapping((previous) => ({
        ...previous,
        headerDocumentMediaId: mediaId,
        headerDocumentFilename:
          headerPdfFile?.name ?? previous.headerDocumentFilename,
      }));
      toast.success("PDF attached.");
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
      goToStep(3);
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
      goToStep(4);
      void queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not delete campaign.");
      }
    },
    onSuccess: (_data, id) => {
      toast.success("Campaign deleted.");
      if (campaignId === id) {
        clearCampaign();
      }
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const selectedTemplate = useMemo(
    () =>
      templatesQuery.data?.find(
        (item) => `${item.name}:${item.language}` === selectedTemplateKey
      ),
    [templatesQuery.data, selectedTemplateKey]
  );

  const counts = detailQuery.data?.counts;
  const campaignStatus = detailQuery.data?.campaign.status;
  const openingExistingCampaign =
    Boolean(campaignId) &&
    step === 0 &&
    !detailQuery.data &&
    !detailQuery.isError &&
    (detailQuery.isLoading || detailQuery.isFetching);
  const templateCapability = useMemo(() => {
    if (selectedTemplate?.capability) {
      return selectedTemplate.capability;
    }
    const snapshot = detailQuery.data?.campaign.templateSnapshot;
    if (snapshot) {
      return assessTemplateCapability(snapshot);
    }
    return null;
  }, [detailQuery.data?.campaign.templateSnapshot, selectedTemplate]);

  const sendReadiness = useMemo(() => {
    if (!counts || !campaignStatus) {
      return { ready: false, blockingReasons: [] as string[] };
    }
    return assessSendReadiness(
      campaignStatus,
      detailQuery.data?.campaign.templateName ?? null,
      detailQuery.data?.campaign.templateLanguage ?? null,
      templateCapability,
      counts.pending
    );
  }, [
    assessSendReadiness,
    campaignStatus,
    counts,
    detailQuery.data?.campaign.templateLanguage,
    detailQuery.data?.campaign.templateName,
    templateCapability,
  ]);

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
          {openingExistingCampaign ? (
            <p className="text-sm text-muted-foreground">Opening campaign…</p>
          ) : null}

          {!openingExistingCampaign && campaignId &&
            campaignStatus &&
            allowsSetupNavigation(campaignStatus) &&
            isDraftSetupStep(step) && (
              <div className="flex flex-wrap gap-2 border-b pb-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => goToStep(step - 1, { userNavigated: true })}
                  disabled={step <= 1}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => clearCampaign()}
                >
                  All campaigns
                </Button>
              </div>
            )}

          {!openingExistingCampaign && step === 0 && (
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
                    <div
                      key={campaign.id}
                      className="flex w-full items-center gap-2 rounded-lg border p-2 hover:bg-muted/40"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center justify-between p-1 text-left"
                        onClick={() => setCampaignId(campaign.id)}
                      >
                        <span className="font-medium">{campaign.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {campaign.status}
                        </span>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            aria-label={`Options for ${campaign.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(campaign)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!openingExistingCampaign && step === 1 && campaignId && (
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
              {counts && counts.pending > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => goToStep(2, { userNavigated: true })}
                >
                  Continue to template
                </Button>
              )}
            </>
          )}

          {!openingExistingCampaign && step === 2 && campaignId && (
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
                      onValueChange={(key) => {
                        const template = templatesQuery.data?.find(
                          (item) => `${item.name}:${item.language}` === key
                        );
                        onTemplateSelected(key, template?.capability);
                      }}
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

                  {(selectedTemplate?.capability.previewHeader ||
                    selectedTemplate?.capability.previewBody) && (
                    <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
                      {selectedTemplate.capability.previewHeader && (
                        <p>
                          <span className="font-medium">Header: </span>
                          {selectedTemplate.capability.previewHeader}
                        </p>
                      )}
                      {selectedTemplate.capability.previewBody && (
                        <p>{selectedTemplate.capability.previewBody}</p>
                      )}
                    </div>
                  )}

                  {selectedTemplate?.capability.requiresHeaderDocument && (
                    <div className="space-y-3 rounded-lg border p-3">
                      <p className="text-sm font-medium">Attach PDF</p>
                      <Input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(event) =>
                          setHeaderPdfFile(event.target.files?.[0] ?? null)
                        }
                      />
                      <div className="space-y-1">
                        <Label>Or paste Meta media ID</Label>
                        <Input
                          value={headerMediaIdInput}
                          onChange={(event) =>
                            setHeaderMediaIdInput(event.target.value)
                          }
                          placeholder="From a previous WhatsApp upload"
                        />
                      </div>
                      {variableMapping.headerDocumentMediaId?.trim() && (
                        <p className="text-xs text-muted-foreground">
                          Attached for this campaign.
                          {variableMapping.headerDocumentFilename
                            ? ` (${variableMapping.headerDocumentFilename})`
                            : ""}
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={uploadHeaderPdf.isPending || !selectedTemplateKey}
                        onClick={() => uploadHeaderPdf.mutate()}
                      >
                        {variableMapping.headerDocumentMediaId
                          ? "Replace PDF"
                          : "Upload PDF"}
                      </Button>
                    </div>
                  )}

                  <VariableFields
                    mapping={variableMapping}
                    headers={uploadHeaders}
                    onChange={setVariableMapping}
                  />

                  <ButtonUrlFields
                    slots={selectedTemplate?.capability.urlButtonSlots ?? []}
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

          {!openingExistingCampaign && step === 3 && counts && (
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
                  disabled={!sendReadiness.ready || sendTest.isPending}
                >
                  Send test
                </Button>
              </div>

              {!sendReadiness.ready && sendReadiness.blockingReasons.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {sendReadiness.blockingReasons[0]}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => goToStep(2, { userNavigated: true })}
                >
                  Edit template
                </Button>
                <Button
                  onClick={() => startCampaign.mutate()}
                  disabled={!sendReadiness.ready || startCampaign.isPending}
                >
                  Confirm and send campaign
                </Button>
              </div>
            </>
          )}

          {!openingExistingCampaign && step === 4 && campaignId && counts && detailQuery.data && (
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this campaign?"
        description={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.name}?`
            : undefined
        }
        confirmLabel="Delete campaign"
        cancelLabel="Cancel"
        variant="destructive"
        loading={deleteCampaignMutation.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteCampaignMutation.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
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

function ButtonUrlFields({
  slots,
  mapping,
  headers,
  onChange,
}: {
  slots: TemplateUrlButtonSlot[];
  mapping: CampaignVariableMapping;
  headers: string[];
  onChange: (value: CampaignVariableMapping) => void;
}) {
  const dynamic = slots.filter((slot) => slot.dynamic);
  if (dynamic.length === 0) return null;

  const buttonUrls = mapping.buttonUrls ?? [];

  const updateButtonSource = (
    urlButtonIndex: number,
    source: CampaignButtonUrlMapping["source"]
  ) => {
    const nextUrls = [...buttonUrls];
    const existingIndex = nextUrls.findIndex(
      (row) => row.urlButtonIndex === urlButtonIndex
    );
  const row: CampaignButtonUrlMapping = { urlButtonIndex, source };
    if (existingIndex >= 0) nextUrls[existingIndex] = row;
    else nextUrls.push(row);
    onChange({ ...mapping, buttonUrls: nextUrls });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Personalise link buttons</p>
      {dynamic.map((slot) => {
        const entry = buttonUrls.find(
          (row) => row.urlButtonIndex === slot.urlButtonIndex
        );
        const source = entry?.source ?? { kind: "static" as const, value: "" };
        return (
          <div key={slot.urlButtonIndex} className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-medium">{slot.label}</p>
            <Select
              value={source.kind}
              onValueChange={(kind) => {
                updateButtonSource(
                  slot.urlButtonIndex,
                  kind === "column"
                    ? { kind: "column", column: headers[0] ?? "" }
                    : { kind: "static", value: "" }
                );
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
                onChange={(event) =>
                  updateButtonSource(slot.urlButtonIndex, {
                    kind: "static",
                    value: event.target.value,
                  })
                }
                placeholder="Link suffix (after the fixed part)"
              />
            ) : (
              <Select
                value={source.column ?? ""}
                onValueChange={(column) =>
                  updateButtonSource(slot.urlButtonIndex, {
                    kind: "column",
                    column,
                  })
                }
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