-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('Draft', 'Published', 'Live', 'Completed', 'Archived');

-- CreateEnum
CREATE TYPE "RegistrationKind" AS ENUM ('student', 'school', 'partner_registration', 'student_ambassador');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('Confirmed', 'Checked In');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('Paid', 'Pending', 'Waived');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('Male', 'Female', 'Other');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT,
    "status" "EventStatus" NOT NULL,
    "venue" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "hallCount" INTEGER NOT NULL,
    "registrationDeadline" TIMESTAMP(3) NOT NULL,
    "maxCapacity" INTEGER NOT NULL,
    "registrationCount" INTEGER NOT NULL,
    "checkInCount" INTEGER NOT NULL,
    "bannerImage" TEXT,
    "isFeatured" BOOLEAN NOT NULL,
    "tags" TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seminars" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "panelistSlots" INTEGER NOT NULL,
    "hall" INTEGER NOT NULL,

    CONSTRAINT "seminars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "kind" "RegistrationKind" NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventTitle" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2),
    "checkInTime" TIMESTAMP(3),
    "studentName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "parentPhone" TEXT,
    "college" TEXT,
    "classLabel" TEXT,
    "interestedStream" TEXT,
    "board" TEXT,
    "gender" "Gender",
    "city" TEXT,
    "state" TEXT,
    "course" TEXT,
    "year" TEXT,
    "emailNormalized" TEXT,
    "phoneLast10" TEXT,
    "schoolContactName" TEXT,
    "schoolName" TEXT,
    "schoolCity" TEXT,
    "schoolContactNumber" TEXT,
    "schoolContactEmail" TEXT,
    "partnerRegContactName" TEXT,
    "partnerRegInstitutionName" TEXT,
    "partnerRegCity" TEXT,
    "partnerRegContactNumber" TEXT,
    "partnerRegContactEmail" TEXT,
    "ambassadorName" TEXT,
    "ambassadorClass" TEXT,
    "ambassadorSchoolCollege" TEXT,
    "ambassadorAge" INTEGER,
    "ambassadorPhone" TEXT,
    "ambassadorEmail" TEXT,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_seminars" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "seminarId" TEXT,
    "seminarTitle" TEXT NOT NULL,

    CONSTRAINT "registration_seminars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_number_counters" (
    "prefix" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_number_counters_pkey" PRIMARY KEY ("prefix")
);

-- CreateIndex
CREATE INDEX "seminars_eventId_idx" ON "seminars"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_registrationNumber_key" ON "registrations"("registrationNumber");

-- CreateIndex
CREATE INDEX "registrations_eventId_idx" ON "registrations"("eventId");

-- CreateIndex
CREATE INDEX "registrations_kind_idx" ON "registrations"("kind");

-- CreateIndex
CREATE INDEX "registrations_eventId_kind_idx" ON "registrations"("eventId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_eventId_emailNormalized_key" ON "registrations"("eventId", "emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_eventId_phoneLast10_key" ON "registrations"("eventId", "phoneLast10");

-- CreateIndex
CREATE INDEX "registration_seminars_registrationId_idx" ON "registration_seminars"("registrationId");

-- CreateIndex
CREATE INDEX "registration_seminars_seminarId_idx" ON "registration_seminars"("seminarId");

-- CreateIndex
CREATE UNIQUE INDEX "registration_seminars_registrationId_seminarTitle_key" ON "registration_seminars"("registrationId", "seminarTitle");

-- AddForeignKey
ALTER TABLE "seminars" ADD CONSTRAINT "seminars_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_seminars" ADD CONSTRAINT "registration_seminars_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_seminars" ADD CONSTRAINT "registration_seminars_seminarId_fkey" FOREIGN KEY ("seminarId") REFERENCES "seminars"("id") ON DELETE SET NULL ON UPDATE CASCADE;
