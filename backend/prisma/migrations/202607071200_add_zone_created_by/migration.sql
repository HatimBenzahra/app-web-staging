-- AlterTable
ALTER TABLE "Zone" ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "createdByName" TEXT,
ADD COLUMN     "createdByType" "UserType";

