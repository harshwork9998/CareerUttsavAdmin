import type { ColumnDef } from "@/components/shared";
import {
  PARTIAL_REGISTRATION_EXPORT_HEADERS,
  partialRegistrationExportRow,
  type PartialRegistrationView,
} from "@/lib/registration-attempt";

export const PARTIAL_REGISTRATIONS_TAB = {
  id: "partial",
  label: "Partial Registrations",
} as const;

export { PARTIAL_REGISTRATION_EXPORT_HEADERS, partialRegistrationExportRow };

export function buildPartialRegistrationColumns(): ColumnDef<
  PartialRegistrationView,
  unknown
>[] {
  const text = (
    key: keyof PartialRegistrationView,
    header: string
  ): ColumnDef<PartialRegistrationView, unknown> => ({
    accessorKey: key,
    header,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm">{row.original[key]}</span>
    ),
  });

  return [
    text("startedOn", "Started On"),
    {
      accessorKey: "passId",
      header: "Pass ID",
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-mono text-sm">
          {row.original.passId}
        </span>
      ),
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium">
          {row.original.source}
        </span>
      ),
    },
    text("name", "Name"),
    text("phone", "Contact Number"),
    text("email", "Email"),
    text("classLabel", "Class"),
    text("city", "City"),
    text("lastStep", "Last Step"),
    text("lastActivity", "Last Activity"),
    text("status", "Status"),
  ];
}
