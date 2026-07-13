import { redirect } from "next/navigation";

interface EditEventPageProps {
  params: Promise<{ id: string }>;
}

/** Edit is modal-first on the events overview / detail pages. */
export default async function EditEventPage({ params }: EditEventPageProps) {
  const { id } = await params;
  redirect(`/events/${id}`);
}
