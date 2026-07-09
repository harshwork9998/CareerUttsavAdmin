import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export interface PageSkeletonProps {
  className?: string;
  showActions?: boolean;
}

export function PageSkeleton({
  className,
  showActions = true,
}: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          {showActions && (
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-32" />
            </div>
          )}
        </div>
      </div>

      <Skeleton className="h-10 w-full max-w-md" />

      <CardSkeleton count={3} />
    </div>
  );
}

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
  showHeader?: boolean;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
  showHeader = true,
}: TableSkeletonProps) {
  return (
    <div className={cn("rounded-xl border bg-card", className)}>
      {showHeader && (
        <div className="flex items-center justify-between border-b p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-48" />
        </div>
      )}

      <div className="p-4">
        <div className="mb-3 flex gap-4 border-b pb-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={`head-${i}`} className="h-4 flex-1" />
          ))}
        </div>

        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={`row-${rowIndex}`} className="flex gap-4">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton
                  key={`cell-${rowIndex}-${colIndex}`}
                  className={cn("h-4 flex-1", colIndex === 0 && "max-w-[40%]")}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export function CardSkeleton({ count = 1, className }: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        count > 1 && "sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Card key={`card-skeleton-${index}`}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
