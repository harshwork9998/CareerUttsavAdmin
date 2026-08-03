"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getDefaultRouteForRole } from "@/lib/access-control";
import { useAuthStore } from "@/store/auth-store";
import { PageSkeleton } from "@/components/shared/loading-skeleton";

export default function HomePage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }
    router.replace(getDefaultRouteForRole(user.role));
  }, [hydrated, isAuthenticated, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <PageSkeleton showActions={false} />
    </div>
  );
}
