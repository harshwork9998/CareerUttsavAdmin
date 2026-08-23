-- CreateEnum
CREATE TYPE "AdminUserStatus" AS ENUM ('Active', 'Inactive', 'Suspended', 'Pending Approval', 'Rejected');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('user', 'superuser');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "role" "AdminRole" NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" "AdminUserStatus" NOT NULL,
    "department" TEXT,
    "passwordHash" TEXT NOT NULL,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_role_idx" ON "admin_users"("role");

-- CreateIndex
CREATE INDEX "admin_users_status_idx" ON "admin_users"("status");
