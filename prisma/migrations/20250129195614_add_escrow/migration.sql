/*
  Warnings:

  - Added the required column `privateKeyAuthTag` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `privateKeyIV` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `privateKeySalt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "privateKeyAuthTag" TEXT NOT NULL,
ADD COLUMN     "privateKeyIV" TEXT NOT NULL,
ADD COLUMN     "privateKeySalt" TEXT NOT NULL;
