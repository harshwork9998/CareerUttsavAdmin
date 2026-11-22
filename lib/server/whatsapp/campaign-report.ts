import { prisma } from "@/lib/server/prisma";

function staffStatusLabel(status: string): string {
  switch (status) {
    case "ACCEPTED":
      return "Accepted by WhatsApp";
    case "SIMULATED":
      return "Simulated (dry run — not sent)";
    case "SENT":
      return "Sent";
    case "DELIVERED":
      return "Delivered";
    case "READ":
      return "Read";
    case "FAILED":
      return "Failed";
    case "UNKNOWN":
      return "Delivery unknown";
    case "NEEDS_REVIEW":
      return "Needs review — send outcome uncertain";
    case "PENDING":
      return "Waiting to send";
    case "CLAIMED":
      return "Sending";
    case "OPTED_OUT":
      return "Opted out";
    case "DUPLICATE":
      return "Duplicate";
    case "INVALID":
      return "Invalid number";
    case "SKIPPED":
      return "Skipped";
    default:
      return status;
  }
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Superuser CSV export — includes full 10-digit mobile for reconciliation with uploads.
 * UI summaries remain masked elsewhere.
 */
export async function buildCampaignReportCsv(campaignId: string): Promise<string> {
  const rows = await prisma.whatsAppCampaignRecipient.findMany({
    where: { campaignId },
    orderBy: [{ rowNumber: "asc" }, { createdAt: "asc" }],
    select: {
      rowNumber: true,
      phoneLast10: true,
      waId: true,
      status: true,
      skipReason: true,
      lastError: true,
      rowData: true,
    },
  });

  const lines = [
    ["Row", "Mobile", "WhatsAppId", "Status", "Notes"].join(","),
    ...rows.map((row) => {
      const rowData = (row.rowData as Record<string, string> | null) ?? {};
      const uploadName =
        rowData.name ??
        rowData.Name ??
        rowData.NAME ??
        rowData["Student Name"] ??
        "";
      const notes = [row.skipReason ?? row.lastError ?? "", uploadName]
        .filter(Boolean)
        .join(" — ")
        .replace(/,/g, " ");
      return [
        row.rowNumber ?? "",
        csvCell(row.phoneLast10),
        csvCell(row.waId),
        staffStatusLabel(row.status),
        csvCell(notes),
      ].join(",");
    }),
  ];

  return `${lines.join("\n")}\n`;
}