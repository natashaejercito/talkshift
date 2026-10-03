/*
  Warnings:

  - You are about to drop the `LoginToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[auth0Id]` on the table `Staff` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "LoginToken" DROP CONSTRAINT "LoginToken_staffId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_staffId_fkey";

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "auth0Id" TEXT;

-- DropTable
DROP TABLE "LoginToken";

-- DropTable
DROP TABLE "Session";

-- CreateIndex
CREATE UNIQUE INDEX "Staff_auth0Id_key" ON "Staff"("auth0Id");
