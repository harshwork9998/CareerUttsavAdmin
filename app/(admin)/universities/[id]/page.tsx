import type { Metadata } from "next";

import { UniversityDetail } from "@/features/universities/university-detail";

export const metadata: Metadata = {
  title: "University Details",
};

interface UniversityDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function UniversityDetailPage({
  params,
}: UniversityDetailPageProps) {
  const { id } = await params;
  return <UniversityDetail id={id} />;
}
