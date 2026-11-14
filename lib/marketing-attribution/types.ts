export type LeadSourceRecord = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LeadSubSourceRecord = {
  id: string;
  leadSourceId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MarketingCampaignRecord = {
  id: string;
  leadSubSourceId: string;
  name: string;
  trackingCode: string;
  placementDescription: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  /** True only when this row and all ancestors are active. */
  effectivelyActive: boolean;
  trackingUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type MarketingAttributionTree = {
  sources: Array<
    LeadSourceRecord & {
      subSources: Array<
        LeadSubSourceRecord & {
          campaigns: MarketingCampaignRecord[];
        }
      >;
    }
  >;
};