-- Sales plans are a shared coaching reference, not owned by a director.
ALTER TABLE "SalesPlan" DROP CONSTRAINT IF EXISTS "SalesPlan_directeurId_fkey";
DROP INDEX IF EXISTS "SalesPlan_directeurId_idx";
ALTER TABLE "SalesPlan" DROP COLUMN IF EXISTS "directeurId";
