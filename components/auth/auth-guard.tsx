"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  canAccessRoute,
  getDefaultRouteForRole,
} from "@/lib/access-control";
import { useAuthStore } from "@/store/auth-store";
import { PageSkeleton } from "@/components/shared/loading-skeleton";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const [storeHydrated, setStoreHydrated] = useState(false);

  useEffect(() => {
    setStoreHydrated(true);
  }, []);

  useEffect(() => {
    if (!storeHydrated) return;
    void restoreSession();
  }, [storeHydrated, restoreSession]);

  useEffect(() => {
    if (!storeHydrated || !hydrated) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [storeHydrated, hydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!storeHydrated || !hydrated || !isAuthenticated || !user) return;

    if (!canAccessRoute(user.role, pathname)) {
      router.replace(getDefaultRouteForRole(user.role));
    }
  }, [storeHydrated, hydrated, isAuthenticated, user, pathname, router]);

  if (!storeHydrated || !hydrated) {
    return <PageSkeleton />;
  }

  if (!isAuthenticated || !user) {
    return <PageSkeleton />;
  }

  if (!canAccessRoute(user.role, pathname)) {
    return <PageSkeleton />;
  }

  return <>{children}</>;
}
