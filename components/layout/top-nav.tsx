"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Bell,
  CalendarDays,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  User,
} from "lucide-react";

import { NAV_ITEMS } from "@/constants";
import { mockEvents, mockNotifications } from "@/lib/mock-data";
import { cn, formatDateTime } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { useSidebarStore } from "@/store/sidebar-store";
import { SearchBar } from "@/components/shared/search-bar";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

function useBreadcrumbItems(): BreadcrumbItem[] {
  const pathname = usePathname();

  return useMemo(() => {
    const navItem = NAV_ITEMS.find(
      (item) =>
        pathname === item.href ||
        (item.href !== "/dashboard" && pathname.startsWith(item.href))
    );

    if (navItem && navItem.href !== "/dashboard") {
      return [{ label: navItem.title, href: navItem.href }];
    }

    if (pathname === "/dashboard") {
      return [];
    }

    const segment = pathname.split("/").filter(Boolean).pop();
    if (!segment) return [];

    const label = segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return [{ label }];
  }, [pathname]);
}

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const { currentEventId, setCurrentEventId } = useAppStore();
  const { setMobileOpen } = useSidebarStore();
  const [search, setSearch] = useState("");

  const breadcrumbItems = useBreadcrumbItems();
  const recentNotifications = mockNotifications
    .filter((n) => n.status === "Sent" || n.status === "Scheduled")
    .slice(0, 6);

  const unreadCount = recentNotifications.filter((n) => n.status === "Sent").length;
  const currentEvent = mockEvents.find((e) => e.id === currentEventId);

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "AD";

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const showBreadcrumbs = pathname !== "/dashboard";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="hidden min-w-0 flex-1 flex-col gap-1 sm:flex">
        {showBreadcrumbs && (
          <Breadcrumbs items={breadcrumbItems} showHome={pathname !== "/dashboard"} />
        )}
        {pathname === "/dashboard" && (
          <p className="text-sm font-medium text-foreground">Dashboard</p>
        )}
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3 lg:flex-none">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search events, users..."
          containerClassName="hidden md:block max-w-xs lg:max-w-sm"
        />

        {/* Event selector */}
        <Select value={currentEventId} onValueChange={setCurrentEventId}>
          <SelectTrigger className="hidden h-9 w-[180px] border-dashed sm:flex lg:w-[220px]">
            <CalendarDays className="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Select event">
              {currentEvent?.city ?? "Select event"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {mockEvents.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                <span className="truncate">{event.title}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              <Badge variant="secondary" className="text-xs font-normal">
                {unreadCount} new
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="h-[280px]">
              {recentNotifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex cursor-default flex-col items-start gap-1 p-3 focus:bg-muted"
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-snug">
                      {notification.title}
                    </span>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] capitalize"
                    >
                      {notification.type}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {notification.message}
                  </p>
                  {(notification.sentAt ?? notification.scheduledAt) && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatDateTime(
                        notification.sentAt ?? notification.scheduledAt!
                      )}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </ScrollArea>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/notifications" className="w-full justify-center text-center">
                View all notifications
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Profile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn("relative h-9 gap-2 rounded-full pl-1 pr-2")}
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[100px] truncate text-sm font-medium lg:inline">
                {user?.name ?? "Admin"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span>{user?.name ?? "Admin User"}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user?.email ?? "admin@careerutsav.com"}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
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
      </div>
    </header>
  );
}
