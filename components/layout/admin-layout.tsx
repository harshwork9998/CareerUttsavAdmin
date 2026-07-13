"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/sidebar-store";
import {
  SectionBackButton,
  getSectionBackHref,
} from "@/components/shared/section-back-button";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./sidebar";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const { mobileOpen, setMobileOpen } = useSidebarStore();
  const showSectionBack = Boolean(getSectionBackHref(pathname));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute left-3 top-3 z-20 h-10 w-10 rounded-full bg-background/95 shadow-sm lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <main
          className={cn(
            "flex-1 overflow-y-auto p-4 lg:p-6",
            "pt-14 lg:pt-6"
          )}
        >
          <div className="mx-auto max-w-[1600px] animate-fade-in">
            {showSectionBack ? (
              <div className="mb-4">
                <SectionBackButton />
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
