import type { Metadata } from "next";

import { RegistrationsList } from "@/features/registrations/registrations-list";

export const metadata: Metadata = {
  title: "Registrations",
};

export default function RegistrationsPage() {
  return <RegistrationsList />;
}
