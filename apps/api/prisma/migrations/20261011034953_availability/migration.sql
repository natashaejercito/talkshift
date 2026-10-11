-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('ALL_DAY', 'WINDOW', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "StoreHours" (
    "weekday" INTEGER NOT NULL,
    "openMin" INTEGER NOT NULL,
    "closeMin" INTEGER NOT NULL,

    CONSTRAINT "StoreHours_pkey" PRIMARY KEY ("weekday")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "status" "AvailabilityStatus" NOT NULL,
    "startMin" INTEGER,
    "endMin" INTEGER,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityChange" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "days" JSONB NOT NULL,
    "note" TEXT,
    "status" "ChangeStatus" NOT NULL DEFAULT 'PENDING',
    "managerNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityRule_staffId_weekday_key" ON "AvailabilityRule"("staffId", "weekday");

-- CreateIndex
CREATE INDEX "AvailabilityChange_staffId_status_idx" ON "AvailabilityChange"("staffId", "status");

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityChange" ADD CONSTRAINT "AvailabilityChange_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityChange" ADD CONSTRAINT "AvailabilityChange_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
