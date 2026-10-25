import { EventCheckInScanner } from "@/features/events/event-check-in-scanner";

interface EventCheckInPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventCheckInPage({ params }: EventCheckInPageProps) {
  const { id } = await params;
  return <EventCheckInScanner eventId={id} />;
}
