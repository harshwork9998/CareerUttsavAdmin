"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  LogOut,
  Mic2,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import { NAV_ITEMS } from "@/constants";
import { BrandLogo } from "@/components/shared/brand-logo";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useSidebarStore } from "@/store/sidebar-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  CalendarDays,
  Users,
  GraduationCap,
  Handshake,
  Mic2,
  UserCog,
};

const HOVER_COLLAPSE_DELAY_MS = 220;

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggle } = useSidebarStore();
  const { user, logout } = useAuthStore();
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuOpenRef = useRef(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const forceExpanded = Boolean(onNavigate);
  const isPinnedOpen = forceExpanded || !collapsed;
  const showExpanded = isPinnedOpen || hoverExpanded;
  const railWidth = 72;
  const expandedWidth = 260;
  const shellWidth = isPinnedOpen ? expandedWidth : railWidth;

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "AD";

  const handleLogout = () => {
    logout();
    onNavigate?.();
    router.push("/login");
  };

  const clearCollapseTimer = () => {
    if (collapseTimerRef.current !== null) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  };

  const scheduleHoverCollapse = () => {
    if (userMenuOpenRef.current || forceExpanded || !collapsed) return;
    clearCollapseTimer();
    collapseTimerRef.current = setTimeout(() => {
      setHoverExpanded(false);
      collapseTimerRef.current = null;
    }, HOVER_COLLAPSE_DELAY_MS);
  };

  useEffect(() => clearCollapseTimer, []);

  const handleMouseEnter = () => {
    clearCollapseTimer();
    if (!forceExpanded && collapsed) {
      setHoverExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    scheduleHoverCollapse();
  };

  const handleUserMenuOpenChange = (open: boolean) => {
    userMenuOpenRef.current = open;
    setUserMenuOpen(open);
    if (open) {
      clearCollapseTimer();
      if (!forceExpanded && collapsed) {
        setHoverExpanded(true);
      }
      return;
    }
    scheduleHoverCollapse();
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn("relative h-full shrink-0", className)}
        style={{ width: shellWidth }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <motion.aside
          initial={false}
          animate={{ width: showExpanded ? expandedWidth : railWidth }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className={cn(
            "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
            !isPinnedOpen && "absolute inset-y-0 left-0 z-50",
            !isPinnedOpen && hoverExpanded && "shadow-2xl ring-1 ring-sidebar-border/80"
          )}
        >
        <div
          className={cn(
            "flex items-center justify-center border-b border-sidebar-border px-3",
            showExpanded ? "h-24 py-4" : "h-[4.5rem] py-3"
          )}
        >
          <motion.div layout className="flex w-full items-center justify-center">
            <BrandLogo variant={showExpanded ? "sidebar" : "icon"} priority />
          </motion.div>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              const linkContent = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-lg bg-secondary/20"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <Icon
                    className={cn(
                      "relative z-10 h-[18px] w-[18px] shrink-0",
                      isActive
                        ? "text-secondary"
                        : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground"
                    )}
                  />
                  <AnimatePresence mode="wait">
                    {showExpanded && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="relative z-10 truncate"
                      >
                        {item.title}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              );

              if (!showExpanded) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={item.href}>{linkContent}</div>;
            })}
          </nav>
        </ScrollArea>

        <div className="space-y-2 border-t border-sidebar-border p-3">
          <DropdownMenu open={userMenuOpen} onOpenChange={handleUserMenuOpenChange}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-auto w-full justify-start gap-3 px-2 py-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  !showExpanded && "justify-center px-0"
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={user?.avatar} alt={user?.name} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                {showExpanded && (
                  <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
                    {user?.name ?? "Admin"}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="end"
              className="w-56"
              onMouseEnter={() => {
                clearCollapseTimer();
                if (collapsed && !forceExpanded) {
                  setHoverExpanded(true);
                }
              }}
              onMouseLeave={scheduleHoverCollapse}
            >
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span>{user?.name ?? "Admin User"}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user?.email ?? "admin@careeruttsav.com"}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {!forceExpanded ? (
            <Button
              variant="ghost"
              size={showExpanded && !collapsed ? "default" : "icon"}
              onClick={toggle}
              className={cn(
                "w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                !showExpanded && "h-9 w-9"
              )}
              aria-label={collapsed ? "Pin sidebar open" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  <span className="text-sm">Collapse</span>
                </>
              )}
            </Button>
          ) : null}
        </div>
        </motion.aside>
      </div>
    </TooltipProvider>
  );
}
