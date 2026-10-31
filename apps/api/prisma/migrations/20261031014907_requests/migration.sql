-- CreateEnum
CREATE TYPE "RequestKind" AS ENUM ('TIME_OFF', 'PARTIAL_DAY');

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "timeZone" TEXT NOT NULL,
    "cutoffWeekday" INTEGER NOT NULL,
    "cutoffMin" INTEGER NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOffRequest" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "kind" "RequestKind" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "startMin" INTEGER,
    "endMin" INTEGER,
    "note" TEXT,
    "late" BOOLEAN NOT NULL DEFAULT false,
    "status" "ChangeStatus" NOT NULL DEFAULT 'PENDING',
    "managerNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeOffRequest_staffId_status_idx" ON "TimeOffRequest"("staffId", "status");

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
