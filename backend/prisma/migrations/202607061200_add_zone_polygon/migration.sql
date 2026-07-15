-- Ajoute le support des zones polygonales (GeoJSON) en plus du cercle historique.
-- Modele mixte : polygon NULL = zone cercle heritee (xOrigin/yOrigin/rayon) ;
-- polygon renseigne = zone polygonale, anneau ferme [[lng,lat],...].
-- Colonne jsonb nullable => ajout non destructif, aucune ligne existante impactee.

-- AlterTable
ALTER TABLE "Zone" ADD COLUMN     "polygon" JSONB;
