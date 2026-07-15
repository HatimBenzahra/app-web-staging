-- Les positions GPS sont desormais keyees par un acteur polymorphe (userId + userType)
-- au lieu d'un commercialId : l'app mobile est utilisee par des commerciaux ET des
-- managers, dont les id proviennent de sequences distinctes (collisions possibles).
-- Meme pattern que ZoneEnCours (enum UserType). Les anciennes lignes commercial sont
-- migrees en COMMERCIAL ; les ~72k lignes kiosk (deviceId, sans acteur) sont conservees.

-- AlterTable
ALTER TABLE "GpsPosition" ADD COLUMN "userId" INTEGER;
ALTER TABLE "GpsPosition" ADD COLUMN "userType" "UserType";

-- Backfill: les positions existantes rattachees a un commercial deviennent COMMERCIAL.
UPDATE "GpsPosition" SET "userId" = "commercialId", "userType" = 'COMMERCIAL' WHERE "commercialId" IS NOT NULL;

-- DropForeignKey + DropColumn (l'index commercialId est supprime avec la colonne)
ALTER TABLE "GpsPosition" DROP CONSTRAINT "GpsPosition_commercialId_fkey";
ALTER TABLE "GpsPosition" DROP COLUMN "commercialId";

-- CreateIndex
CREATE INDEX "GpsPosition_userId_userType_idx" ON "GpsPosition"("userId", "userType");
CREATE INDEX "GpsPosition_userId_userType_recordedAt_idx" ON "GpsPosition"("userId", "userType", "recordedAt");
