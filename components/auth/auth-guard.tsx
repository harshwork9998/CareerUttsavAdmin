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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) return;

    if (!canAccessRoute(user.role, pathname)) {
      router.replace(getDefaultRouteForRole(user.role));
    }
  }, [hydrated, isAuthenticated, user, pathname, router]);

  if (!hydrated) {
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
