import { Suspense } from "react";

import { CampaignsView } from "@/features/campaigns/campaigns-view";

export default function CampaignsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Loading campaigns…</div>
      }
    >
      <CampaignsView />
    </Suspense>
  );
}