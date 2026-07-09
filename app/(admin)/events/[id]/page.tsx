import { EventDetail } from "@/features/events/event-detail";

interface EventDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  return <EventDetail eventId={id} />;
}
