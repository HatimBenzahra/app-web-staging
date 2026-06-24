-- Add a terrain habitat type while keeping existing immeubles compatible.
CREATE TYPE "TypeHabitat" AS ENUM ('IMMEUBLE', 'MAISON', 'PAVILLON');

ALTER TABLE "Immeuble"
ADD COLUMN "typeHabitat" "TypeHabitat" NOT NULL DEFAULT 'IMMEUBLE';
