"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Globe, Mail, Phone } from "lucide-react";

import { partnersService } from "@/services/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
  StatusChip,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PartnerDetailProps {
  id: string;
}

export function PartnerDetail({ id }: PartnerDetailProps) {
  const { data: partner, isLoading, isError, refetch } = useQuery({
    queryKey: ["partners", id],
    queryFn: () => partnersService.getById(id),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Partner Details" />
        <CardSkeleton count={2} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Partner Details" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="space-y-6">
        <PageHeader title="Partner Not Found" />
        <EmptyState
          title="Partner not found"
          description="This partner may have been removed."
          action={{ label: "Back to partners", onClick: () => window.history.back() }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={partner.name}
        description={partner.category}
        breadcrumbs={[
          { label: "Partners", href: "/partners" },
          { label: partner.name },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Brand Assets</CardTitle>
            <CardDescription>Logo, website, and partnership benefits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Avatar className="h-24 w-24 rounded-xl">
                <AvatarImage src={partner.logo} alt={partner.name} />
                <AvatarFallback className="rounded-xl text-2xl">
                  {partner.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <StatusChip status={partner.isActive ? "Active" : "Inactive"} />
                {partner.website && (
                  <a
                    href={partner.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Globe className="h-4 w-4" />
                    {partner.website}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            {partner.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {partner.description}
              </p>
            )}

            <Separator />

            <div>
              <h4 className="mb-3 text-sm font-semibold">Partnership Benefits</h4>
              <div className="flex flex-wrap gap-2">
                {partner.benefits.map((benefit) => (
                  <Badge key={benefit} variant="secondary">
                    {benefit}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-medium">{partner.contactPerson}</p>
              <a
                href={`mailto:${partner.contactEmail}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Mail className="h-4 w-4" />
                {partner.contactEmail}
              </a>
              <a
                href={`tel:${partner.contactPhone}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Phone className="h-4 w-4" />
                {partner.contactPhone}
              </a>
              <p className="text-muted-foreground">
                {partner.city}, {partner.state}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sponsorship</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-2xl font-bold">
                {partner.sponsorshipAmount
                  ? formatCurrency(partner.sponsorshipAmount)
                  : "Non-monetary"}
              </p>
              <p className="text-muted-foreground">
                Partner since {formatDate(partner.createdAt)}
              </p>
              <p className="text-muted-foreground">
                {partner.eventIds.length} event(s) linked
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
