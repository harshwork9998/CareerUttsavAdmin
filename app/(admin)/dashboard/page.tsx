import { Fraunces } from "next/font/google";

import { DashboardView } from "@/features/dashboard/dashboard-view";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export default function DashboardPage() {
  return (
    <div className={`${fraunces.variable} dash-root`}>
      <DashboardView />
    </div>
  );
}
