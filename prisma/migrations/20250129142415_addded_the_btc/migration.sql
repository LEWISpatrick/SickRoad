/*
  Warnings:

  - You are about to drop the column `escrow` on the `Transaction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[publicKey]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[privateKey]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `escrowAddress` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `privateKey` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `publicKey` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "escrow",
ADD COLUMN     "escrowAddress" TEXT NOT NULL,
ADD COLUMN     "releaseConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "privateKey" TEXT NOT NULL,
ADD COLUMN     "publicKey" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_publicKey_key" ON "User"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_privateKey_key" ON "User"("privateKey");
