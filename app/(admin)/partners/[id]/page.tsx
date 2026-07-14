import { PartnerJourney } from "@/features/partners/partner-journey";

interface PartnerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PartnerDetailPage({
  params,
}: PartnerDetailPageProps) {
  const { id } = await params;
  return <PartnerJourney partnerId={id} />;
}
