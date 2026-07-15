-- Add terrain neighbourhood grouping for multi-pin prospection.
CREATE TABLE "Quartier" (
  "id" SERIAL NOT NULL,
  "nom" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "commercialId" INTEGER,
  "managerId" INTEGER,
  "zoneId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Quartier_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Quartier"
ADD CONSTRAINT "Quartier_commercialId_fkey"
FOREIGN KEY ("commercialId") REFERENCES "Commercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Quartier"
ADD CONSTRAINT "Quartier_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Quartier"
ADD CONSTRAINT "Quartier_zoneId_fkey"
FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Quartier_commercialId_idx" ON "Quartier"("commercialId");
CREATE INDEX "Quartier_managerId_idx" ON "Quartier"("managerId");
CREATE INDEX "Quartier_zoneId_idx" ON "Quartier"("zoneId");
CREATE INDEX "Quartier_latitude_longitude_idx" ON "Quartier"("latitude", "longitude");

ALTER TABLE "Immeuble"
ADD COLUMN "quartierId" INTEGER,
ADD COLUMN "nbMaisonsPrevu" INTEGER;

ALTER TABLE "Immeuble"
ADD CONSTRAINT "Immeuble_quartierId_fkey"
FOREIGN KEY ("quartierId") REFERENCES "Quartier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
