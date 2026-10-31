-- CreateEnum
CREATE TYPE "CoverStatus" AS ENUM ('OPEN', 'COVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "CoverRequest" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "CoverStatus" NOT NULL DEFAULT 'OPEN',
    "coveredById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupOffer" (
    "id" TEXT NOT NULL,
    "coverRequestId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoverRequest_status_idx" ON "CoverRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PickupOffer_coverRequestId_staffId_key" ON "PickupOffer"("coverRequestId", "staffId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "CoverRequest" ADD CONSTRAINT "CoverRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverRequest" ADD CONSTRAINT "CoverRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverRequest" ADD CONSTRAINT "CoverRequest_coveredById_fkey" FOREIGN KEY ("coveredById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupOffer" ADD CONSTRAINT "PickupOffer_coverRequestId_fkey" FOREIGN KEY ("coverRequestId") REFERENCES "CoverRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupOffer" ADD CONSTRAINT "PickupOffer_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
