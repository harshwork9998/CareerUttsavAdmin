import { redirect } from "next/navigation";

/** Create flow is modal-first on /events. */
export default function NewEventPage() {
  redirect("/events");
}
