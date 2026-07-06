-- Ajoute la duree de prospection chronometree (en secondes).
-- Porte.duree : duree de la derniere prospection chronometree.
-- StatusHistorique.duree : duree de CE passage de prospection.
-- Colonnes INTEGER nullable => ajout non destructif, aucune ligne existante impactee.

-- AlterTable
ALTER TABLE "Porte" ADD COLUMN     "duree" INTEGER;

-- AlterTable
ALTER TABLE "StatusHistorique" ADD COLUMN     "duree" INTEGER;
