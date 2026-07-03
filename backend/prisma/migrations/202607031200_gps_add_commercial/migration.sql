-- Les positions GPS proviennent desormais de l'app mobile (reportMyPositions),
-- rattachees a un commercialId derive du token. Le kiosk n'alimente plus le GPS.
-- deviceId devient nullable pour continuer a lire les anciennes lignes kiosk.

-- AlterTable
ALTER TABLE "GpsPosition" ALTER COLUMN "deviceId" DROP NOT NULL;
ALTER TABLE "GpsPosition" ADD COLUMN "commercialId" INTEGER;

-- CreateIndex
CREATE INDEX "GpsPosition_commercialId_recordedAt_idx" ON "GpsPosition"("commercialId", "recordedAt");

-- AddForeignKey
ALTER TABLE "GpsPosition"
  ADD CONSTRAINT "GpsPosition_commercialId_fkey"
  FOREIGN KEY ("commercialId") REFERENCES "Commercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
