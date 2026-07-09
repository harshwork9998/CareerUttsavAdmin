import type { Metadata } from "next";

import { UniversitiesList } from "@/features/universities/universities-list";

export const metadata: Metadata = {
  title: "Universities",
};

export default function UniversitiesPage() {
  return <UniversitiesList />;
}
