/*
  Warnings:

  - A unique constraint covering the columns `[keycloakSub]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "keycloakSub" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_keycloakSub_key" ON "Customer"("keycloakSub");
