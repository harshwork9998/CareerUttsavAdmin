import { PartnerDetail } from "@/features/partners/partner-detail";

interface PartnerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PartnerDetailPage({ params }: PartnerDetailPageProps) {
  const { id } = await params;
  return <PartnerDetail id={id} />;
}
