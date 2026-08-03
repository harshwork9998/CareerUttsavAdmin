import {
  formatSeminarInterests,
  getPrimarySeminar,
} from "@/lib/enrich-registration";
import {
  isPartnerRegistrationEntry,
  isSchoolRegistration,
  isStudentAmbassadorRegistration,
  isStudentRegistration,
} from "@/lib/registration-kinds";
import type { ColumnDef } from "@/components/shared";
import type { Registration, RegistrationKind } from "@/types";

export function getRegistrationDisplayName(registration: Registration): string {
  if (isStudentRegistration(registration)) return registration.studentName;
  if (isSchoolRegistration(registration)) return registration.schoolContactName;
  if (isPartnerRegistrationEntry(registration)) {
    return registration.partnerRegContactName;
  }
  if (isStudentAmbassadorRegistration(registration)) {
    return registration.ambassadorName;
  }
  return "—";
}

export function buildRegistrationColumns(
  kind: RegistrationKind,
  eventTitleById: Map<string, string>
): ColumnDef<Registration, unknown>[] {
  const eventColumn: ColumnDef<Registration, unknown> = {
    id: "eventTitle",
    header: "Event",
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-[220px] text-sm">
        {eventTitleById.get(row.original.eventId) ?? row.original.eventTitle}
      </span>
    ),
  };

  if (kind === "student") {
    return [
      {
        accessorKey: "studentName",
        header: "Student Name",
        cell: ({ row }) => (
          <span className="font-medium whitespace-nowrap">
            {isStudentRegistration(row.original)
              ? row.original.studentName
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "college",
        header: "School/College",
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[200px] text-sm">
            {isStudentRegistration(row.original) ? row.original.college : "—"}
          </span>
        ),
      },
      eventColumn,
      {
        accessorKey: "classLabel",
        header: "Class",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {isStudentRegistration(row.original)
              ? (row.original.classLabel ?? "—")
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "interestedStream",
        header: "Stream",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {isStudentRegistration(row.original)
              ? (row.original.interestedStream ?? "—")
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "board",
        header: "Board",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {isStudentRegistration(row.original)
              ? (row.original.board ?? "—")
              : "—"}
          </span>
        ),
      },
      {
        id: "seminarInterests",
        header: "Seminar",
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[220px] text-sm">
            {formatSeminarInterests(row.original)}
          </span>
        ),
      },
      {
        accessorKey: "city",
        header: "City",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {isStudentRegistration(row.original) ? row.original.city : "—"}
          </span>
        ),
      },
      {
        accessorKey: "gender",
        header: "Gender",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {isStudentRegistration(row.original)
              ? (row.original.gender ?? "—")
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Student Mobile Number",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {isStudentRegistration(row.original) ? row.original.phone : "—"}
          </span>
        ),
      },
      {
        accessorKey: "parentPhone",
        header: "Parent Mobile Number",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {isStudentRegistration(row.original)
              ? (row.original.parentPhone ?? "—")
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email Address",
        cell: ({ row }) => (
          <span className="max-w-[200px] truncate text-sm">
            {isStudentRegistration(row.original) ? row.original.email : "—"}
          </span>
        ),
      },
    ];
  }

  if (kind === "school") {
    return [
      {
        id: "schoolContactName",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium whitespace-nowrap">
            {isSchoolRegistration(row.original)
              ? row.original.schoolContactName
              : "—"}
          </span>
        ),
      },
      {
        id: "schoolName",
        header: "School Name",
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[220px] text-sm">
            {isSchoolRegistration(row.original) ? row.original.schoolName : "—"}
          </span>
        ),
      },
      eventColumn,
      {
        id: "schoolCity",
        header: "City",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {isSchoolRegistration(row.original) ? row.original.schoolCity : "—"}
          </span>
        ),
      },
      {
        id: "schoolContactNumber",
        header: "Contact Number",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {isSchoolRegistration(row.original)
              ? row.original.schoolContactNumber
              : "—"}
          </span>
        ),
      },
      {
        id: "schoolContactEmail",
        header: "Email",
        cell: ({ row }) => (
          <span className="max-w-[200px] truncate text-sm">
            {isSchoolRegistration(row.original)
              ? row.original.schoolContactEmail
              : "—"}
          </span>
        ),
      },
    ];
  }

  if (kind === "partner_registration") {
    return [
      {
        id: "partnerRegContactName",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium whitespace-nowrap">
            {isPartnerRegistrationEntry(row.original)
              ? row.original.partnerRegContactName
              : "—"}
          </span>
        ),
      },
      {
        id: "partnerRegInstitutionName",
        header: "Institution Name",
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[220px] text-sm">
            {isPartnerRegistrationEntry(row.original)
              ? row.original.partnerRegInstitutionName
              : "—"}
          </span>
        ),
      },
      eventColumn,
      {
        id: "partnerRegCity",
        header: "City",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {isPartnerRegistrationEntry(row.original)
              ? row.original.partnerRegCity
              : "—"}
          </span>
        ),
      },
      {
        id: "partnerRegContactNumber",
        header: "Contact Number",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {isPartnerRegistrationEntry(row.original)
              ? row.original.partnerRegContactNumber
              : "—"}
          </span>
        ),
      },
      {
        id: "partnerRegContactEmail",
        header: "Email",
        cell: ({ row }) => (
          <span className="max-w-[200px] truncate text-sm">
            {isPartnerRegistrationEntry(row.original)
              ? row.original.partnerRegContactEmail
              : "—"}
          </span>
        ),
      },
    ];
  }

  return [
    {
      id: "ambassadorName",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium whitespace-nowrap">
          {isStudentAmbassadorRegistration(row.original)
            ? row.original.ambassadorName
            : "—"}
        </span>
      ),
    },
    {
      id: "ambassadorClass",
      header: "Class",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">
          {isStudentAmbassadorRegistration(row.original)
            ? row.original.ambassadorClass
            : "—"}
        </span>
      ),
    },
    {
      id: "ambassadorSchoolCollege",
      header: "School/College Name",
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-[220px] text-sm">
          {isStudentAmbassadorRegistration(row.original)
            ? row.original.ambassadorSchoolCollege
            : "—"}
        </span>
      ),
    },
    eventColumn,
    {
      id: "ambassadorAge",
      header: "Age",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">
          {isStudentAmbassadorRegistration(row.original)
            ? row.original.ambassadorAge
            : "—"}
        </span>
      ),
    },
    {
      id: "ambassadorPhone",
      header: "Number",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">
          {isStudentAmbassadorRegistration(row.original)
            ? row.original.ambassadorPhone
            : "—"}
        </span>
      ),
    },
    {
      id: "ambassadorEmail",
      header: "Email",
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate text-sm">
          {isStudentAmbassadorRegistration(row.original)
            ? row.original.ambassadorEmail
            : "—"}
        </span>
      ),
    },
  ];
}

export function exportHeadersForKind(kind: RegistrationKind): string[] {
  switch (kind) {
    case "student":
      return [
        "Student Name",
        "School/College",
        "Event",
        "Class",
        "Stream",
        "Board",
        "Seminar",
        "City",
        "Gender",
        "Student Mobile Number",
        "Parent Mobile Number",
        "Email Address",
      ];
    case "school":
      return [
        "Name",
        "School Name",
        "Event",
        "City",
        "Contact Number",
        "Email",
      ];
    case "partner_registration":
      return [
        "Name",
        "Institution Name",
        "Event",
        "City",
        "Contact Number",
        "Email",
      ];
    case "student_ambassador":
      return [
        "Name",
        "Class",
        "School/College Name",
        "Event",
        "Age",
        "Number",
        "Email",
      ];
  }
}

export function exportRowForKind(
  registration: Registration,
  eventTitleById: Map<string, string>
): string[] {
  const eventTitle =
    eventTitleById.get(registration.eventId) ?? registration.eventTitle;

  if (isStudentRegistration(registration)) {
    return [
      registration.studentName,
      registration.college,
      eventTitle,
      registration.classLabel ?? "",
      registration.interestedStream ?? "",
      registration.board ?? "",
      formatSeminarInterests(registration),
      registration.city,
      registration.gender ?? "",
      registration.phone,
      registration.parentPhone ?? "",
      registration.email,
    ];
  }
  if (isSchoolRegistration(registration)) {
    return [
      registration.schoolContactName,
      registration.schoolName,
      eventTitle,
      registration.schoolCity,
      registration.schoolContactNumber,
      registration.schoolContactEmail,
    ];
  }
  if (isPartnerRegistrationEntry(registration)) {
    return [
      registration.partnerRegContactName,
      registration.partnerRegInstitutionName,
      eventTitle,
      registration.partnerRegCity,
      registration.partnerRegContactNumber,
      registration.partnerRegContactEmail,
    ];
  }
  if (isStudentAmbassadorRegistration(registration)) {
    return [
      registration.ambassadorName,
      registration.ambassadorClass,
      registration.ambassadorSchoolCollege,
      eventTitle,
      String(registration.ambassadorAge),
      registration.ambassadorPhone,
      registration.ambassadorEmail,
    ];
  }
  return [];
}

export function registrationMatchesSearch(
  registration: Registration,
  query: string
): boolean {
  const haystack: string[] = [getRegistrationDisplayName(registration)];

  if (isStudentRegistration(registration)) {
    haystack.push(
      registration.email,
      registration.phone,
      registration.parentPhone ?? "",
      registration.college,
      registration.classLabel ?? "",
      registration.interestedStream ?? "",
      registration.board ?? "",
      formatSeminarInterests(registration),
      getPrimarySeminar(registration),
      registration.city
    );
  } else if (isSchoolRegistration(registration)) {
    haystack.push(
      registration.schoolName,
      registration.schoolCity,
      registration.schoolContactNumber,
      registration.schoolContactEmail
    );
  } else if (isPartnerRegistrationEntry(registration)) {
    haystack.push(
      registration.partnerRegInstitutionName,
      registration.partnerRegCity,
      registration.partnerRegContactNumber,
      registration.partnerRegContactEmail
    );
  } else if (isStudentAmbassadorRegistration(registration)) {
    haystack.push(
      registration.ambassadorClass,
      registration.ambassadorSchoolCollege,
      String(registration.ambassadorAge),
      registration.ambassadorPhone,
      registration.ambassadorEmail
    );
  }

  return haystack.some((value) => value.toLowerCase().includes(query));
}
