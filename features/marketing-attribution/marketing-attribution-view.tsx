"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Download,
  Megaphone,
  Pencil,
  Plus,
  QrCode,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  TableSkeleton,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  campaignQrImageUrl,
  createLeadSourceApi,
  createLeadSubSourceApi,
  createMarketingCampaignApi,
  fetchMarketingAttributionTree,
  suggestCampaignCodeApi,
  updateLeadSourceApi,
  updateLeadSubSourceApi,
  updateMarketingCampaignApi,
} from "@/lib/marketing-attribution-api-client";
import type {
  LeadSourceRecord,
  LeadSubSourceRecord,
  MarketingCampaignRecord,
} from "@/lib/marketing-attribution/types";

const QUERY_KEY = ["marketing-attribution"];

function ActiveBadge({ active, effective }: { active: boolean; effective?: boolean }) {
  if (effective === false && active) {
    return <Badge variant="secondary">Inactive (parent)</Badge>;
  }
  return active ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
  ) : (
    <Badge variant="secondary">Inactive</Badge>
  );
}

export function MarketingAttributionView() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchMarketingAttributionTree,
  });

  const sources = data?.sources ?? [];

  const flatSubSources = useMemo(
    () =>
      sources.flatMap((s) =>
        s.subSources.map((sub) => ({
          ...sub,
          sourceName: s.name,
          sourceActive: s.isActive,
        }))
      ),
    [sources]
  );

  const flatCampaigns = useMemo(
    () =>
      sources.flatMap((s) =>
        s.subSources.flatMap((sub) =>
          sub.campaigns.map((c) => ({
            ...c,
            sourceName: s.name,
            subSourceName: sub.name,
          }))
        )
      ),
    [sources]
  );

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const [sourceDialog, setSourceDialog] = useState<
    { mode: "create" } | { mode: "edit"; record: LeadSourceRecord } | null
  >(null);
  const [subDialog, setSubDialog] = useState<
    { mode: "create"; leadSourceId?: string } | { mode: "edit"; record: LeadSubSourceRecord } | null
  >(null);
  const [campaignDialog, setCampaignDialog] = useState<
    | { mode: "create"; leadSubSourceId?: string }
    | { mode: "edit"; record: MarketingCampaignRecord }
    | null
  >(null);
  const [qrCampaign, setQrCampaign] = useState<MarketingCampaignRecord | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<
    | { kind: "source"; record: LeadSourceRecord }
    | { kind: "sub"; record: LeadSubSourceRecord }
    | { kind: "campaign"; record: MarketingCampaignRecord }
    | null
  >(null);

  const [sourceName, setSourceName] = useState("");
  const [sourceDescription, setSourceDescription] = useState("");
  const [subName, setSubName] = useState("");
  const [subParentId, setSubParentId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [campaignParentId, setCampaignParentId] = useState("");
  const [campaignCode, setCampaignCode] = useState("");
  const [campaignPlacement, setCampaignPlacement] = useState("");
  const [campaignStart, setCampaignStart] = useState("");
  const [campaignEnd, setCampaignEnd] = useState("");

  const sourceMutation = useMutation({
    mutationFn: async () => {
      if (!sourceDialog) return;
      const name = sourceName.trim();
      const description = sourceDescription.trim() || undefined;
      if (sourceDialog.mode === "create") {
        await createLeadSourceApi({ name, description });
      } else {
        await updateLeadSourceApi(sourceDialog.record.id, { name, description });
      }
    },
    onSuccess: () => {
      toast.success("Lead source saved");
      setSourceDialog(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subMutation = useMutation({
    mutationFn: async () => {
      if (!subDialog) return;
      const name = subName.trim();
      if (subDialog.mode === "create") {
        await createLeadSubSourceApi({
          leadSourceId: subParentId.trim(),
          name,
        });
      } else {
        await updateLeadSubSourceApi(subDialog.record.id, { name });
      }
    },
    onSuccess: () => {
      toast.success("Sub-source saved");
      setSubDialog(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const campaignMutation = useMutation({
    mutationFn: async () => {
      if (!campaignDialog) return;
      const name = campaignName.trim();
      const placementDescription = campaignPlacement.trim() || undefined;
      if (campaignDialog.mode === "create") {
        await createMarketingCampaignApi({
          leadSubSourceId: campaignParentId.trim(),
          name,
          trackingCode: campaignCode.trim() || undefined,
          placementDescription,
          startDate: campaignStart ? new Date(campaignStart).toISOString() : null,
          endDate: campaignEnd ? new Date(campaignEnd).toISOString() : null,
        });
      } else {
        await updateMarketingCampaignApi(campaignDialog.record.id, {
          name,
          placementDescription: placementDescription ?? null,
          startDate: campaignStart ? new Date(campaignStart).toISOString() : null,
          endDate: campaignEnd ? new Date(campaignEnd).toISOString() : null,
        });
      }
    },
    onSuccess: () => {
      toast.success("Campaign saved");
      setCampaignDialog(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (target: NonNullable<typeof deactivateTarget>) => {
      if (target.kind === "source") {
        await updateLeadSourceApi(target.record.id, { isActive: false });
      } else if (target.kind === "sub") {
        await updateLeadSubSourceApi(target.record.id, { isActive: false });
      } else {
        await updateMarketingCampaignApi(target.record.id, { isActive: false });
      }
    },
    onSuccess: () => {
      toast.success("Deactivated");
      setDeactivateTarget(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreateSource() {
    setSourceName("");
    setSourceDescription("");
    setSourceDialog({ mode: "create" });
  }

  function openEditSource(record: LeadSourceRecord) {
    setSourceName(record.name);
    setSourceDescription(record.description ?? "");
    setSourceDialog({ mode: "edit", record });
  }

  function openCreateSub(leadSourceId?: string) {
    setSubName("");
    setSubParentId(leadSourceId ?? sources.find((s) => s.isActive)?.id ?? "");
    setSubDialog({ mode: "create", leadSourceId });
  }

  function openEditSub(record: LeadSubSourceRecord) {
    setSubName(record.name);
    setSubDialog({ mode: "edit", record });
  }

  function openCreateCampaign(leadSubSourceId?: string) {
    setCampaignName("");
    setCampaignParentId(
      leadSubSourceId ??
        flatSubSources.find((s) => s.isActive && s.sourceActive)?.id ??
        ""
    );
    setCampaignCode("");
    setCampaignPlacement("");
    setCampaignStart("");
    setCampaignEnd("");
    setCampaignDialog({ mode: "create", leadSubSourceId });
  }

  function openEditCampaign(record: MarketingCampaignRecord) {
    setCampaignName(record.name);
    setCampaignPlacement(record.placementDescription ?? "");
    setCampaignStart(record.startDate?.slice(0, 10) ?? "");
    setCampaignEnd(record.endDate?.slice(0, 10) ?? "");
    setCampaignDialog({ mode: "edit", record });
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Tracking URL copied");
    } catch {
      toast.error("Could not copy URL");
    }
  }

  async function suggestCode() {
    const name = campaignName.trim();
    if (!name) {
      toast.error("Enter a campaign name first");
      return;
    }
    try {
      const code = await suggestCampaignCodeApi(name);
      setCampaignCode(code);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not suggest code");
    }
  }

  if (isLoading) return <TableSkeleton />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const editingCampaign =
    campaignDialog?.mode === "edit" ? campaignDialog.record : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Attribution"
        description="Configure lead sources, sub-sources, and campaigns. Tracking URLs and QR codes are ready; website capture goes live in Phase 2."
        actions={
          <Button onClick={openCreateSource}>
            <Plus className="mr-2 h-4 w-4" />
            Lead source
          </Button>
        }
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">Phase 1 — configuration only</p>
        <p className="mt-1 text-amber-900/90 dark:text-amber-100/80">
          QR codes and URLs use <span className="font-mono text-xs">?ref=CODE</span> on
          the public site. Registrations will not attribute to campaigns until Phase 2
          deploys URL capture on careeruttsav.in.
        </p>
      </div>

      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">Lead sources</TabsTrigger>
          <TabsTrigger value="sub-sources">Sub-sources</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-4">
          {sources.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No lead sources yet"
              description="Add Offline Marketing and other top-level categories."
              action={{ label: "Add lead source", onClick: openCreateSource }}
            />
          ) : (
            <div className="grid gap-3">
              {sources.map((source) => (
                <div key={source.id} className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{source.name}</h3>
                        <ActiveBadge active={source.isActive} />
                      </div>
                      {source.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {source.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditSource(source)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCreateSub(source.id)}
                        disabled={!source.isActive}
                      >
                        Add sub-source
                      </Button>
                      {source.isActive ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setDeactivateTarget({ kind: "source", record: source })}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() =>
                            void updateLeadSourceApi(source.id, { isActive: true }).then(() => {
                              toast.success("Activated");
                              invalidate();
                            })
                          }
                        >
                          Activate
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sub-sources" className="space-y-4">
          <Button size="sm" onClick={() => openCreateSub()} disabled={sources.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Sub-source
          </Button>
          {flatSubSources.length === 0 ? (
            <EmptyState title="No sub-sources" description="Create sub-sources under a lead source." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Lead source</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flatSubSources.map((sub) => (
                    <tr key={sub.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{sub.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{sub.sourceName}</td>
                      <td className="px-3 py-2">
                        <ActiveBadge
                          active={sub.isActive}
                          effective={sub.isActive && sub.sourceActive}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEditSub(sub)}>
                            Edit
                          </Button>
                          {sub.isActive ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeactivateTarget({ kind: "sub", record: sub })}
                            >
                              Deactivate
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Button
            size="sm"
            onClick={() => openCreateCampaign()}
            disabled={flatSubSources.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Campaign
          </Button>
          {flatCampaigns.length === 0 ? (
            <EmptyState
              title="No campaigns"
              description="Create campaigns with unique tracking codes."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Campaign</th>
                    <th className="px-3 py-2 font-medium">Hierarchy</th>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Tracking URL</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flatCampaigns.map((c) => (
                    <tr key={c.id} className="border-t align-top">
                      <td className="px-3 py-2 font-medium">{c.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {c.sourceName} → {c.subSourceName}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{c.trackingCode}</td>
                      <td className="max-w-[240px] px-3 py-2">
                        <span className="line-clamp-2 break-all text-xs">{c.trackingUrl}</span>
                      </td>
                      <td className="px-3 py-2">
                        <ActiveBadge active={c.isActive} effective={c.effectivelyActive} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="ghost" onClick={() => void copyUrl(c.trackingUrl)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setQrCampaign(c)}>
                            <QrCode className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <a
                              href={campaignQrImageUrl(c.id)}
                              download={`${c.trackingCode}-qr.png`}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEditCampaign(c)}>
                            Edit
                          </Button>
                          {c.isActive ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDeactivateTarget({ kind: "campaign", record: c })
                              }
                            >
                              Deactivate
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={sourceDialog !== null} onOpenChange={(o) => !o && setSourceDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sourceDialog?.mode === "edit" ? "Edit lead source" : "New lead source"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="source-name">Name</Label>
              <Input
                id="source-name"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="source-desc">Description (optional)</Label>
              <Textarea
                id="source-desc"
                value={sourceDescription}
                onChange={(e) => setSourceDescription(e.target.value)}
              />
            </div>
            <Button onClick={() => sourceMutation.mutate()} disabled={sourceMutation.isPending}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={subDialog !== null} onOpenChange={(o) => !o && setSubDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {subDialog?.mode === "edit" ? "Edit sub-source" : "New sub-source"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {subDialog?.mode === "create" ? (
              <div>
                <Label>Parent lead source</Label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={subParentId}
                  onChange={(e) => setSubParentId(e.target.value)}
                >
                  {sources
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}
            <div>
              <Label>Name</Label>
              <Input value={subName} onChange={(e) => setSubName(e.target.value)} />
            </div>
            <Button onClick={() => subMutation.mutate()} disabled={subMutation.isPending}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={campaignDialog !== null} onOpenChange={(o) => !o && setCampaignDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {campaignDialog?.mode === "edit" ? "Edit campaign" : "New campaign"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {campaignDialog?.mode === "create" ? (
              <div>
                <Label>Sub-source</Label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={campaignParentId}
                  onChange={(e) => setCampaignParentId(e.target.value)}
                >
                  {flatSubSources
                    .filter((s) => s.isActive && s.sourceActive)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sourceName} — {s.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : editingCampaign ? (
              <p className="text-sm text-muted-foreground">
                Tracking code:{" "}
                <span className="font-mono">{editingCampaign.trackingCode}</span> (immutable)
              </p>
            ) : null}
            <div>
              <Label>Campaign name</Label>
              <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
            </div>
            {campaignDialog?.mode === "create" ? (
              <div>
                <Label>Tracking code</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={campaignCode}
                    onChange={(e) => setCampaignCode(e.target.value.toUpperCase())}
                    placeholder="AUTO26"
                    className="font-mono"
                  />
                  <Button type="button" variant="outline" onClick={() => void suggestCode()}>
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
            <div>
              <Label>Placement / description (optional)</Label>
              <Textarea
                value={campaignPlacement}
                onChange={(e) => setCampaignPlacement(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={campaignStart}
                  onChange={(e) => setCampaignStart(e.target.value)}
                />
              </div>
              <div>
                <Label>End date</Label>
                <Input
                  type="date"
                  value={campaignEnd}
                  onChange={(e) => setCampaignEnd(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={() => campaignMutation.mutate()}
              disabled={campaignMutation.isPending}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={qrCampaign !== null} onOpenChange={(o) => !o && setQrCampaign(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR preview — {qrCampaign?.trackingCode}</DialogTitle>
          </DialogHeader>
          {qrCampaign ? (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={campaignQrImageUrl(qrCampaign.id)}
                alt={`QR for ${qrCampaign.trackingCode}`}
                className="h-64 w-64 rounded border"
              />
              <p className="break-all text-center text-xs text-muted-foreground">
                {qrCampaign.trackingUrl}
              </p>
              <Button variant="outline" onClick={() => void copyUrl(qrCampaign.trackingUrl)}>
                <Copy className="mr-2 h-4 w-4" />
                Copy URL
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate?"
        description="Historical records keep their associations. Future attribution will ignore inactive items in the chain."
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={() => {
          if (deactivateTarget) toggleMutation.mutate(deactivateTarget);
        }}
        loading={toggleMutation.isPending}
      />
    </div>
  );
}