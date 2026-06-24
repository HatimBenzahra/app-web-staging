CREATE TABLE "acquiscan_zone_targets" (
  "id" SERIAL NOT NULL,
  "zone_id" INTEGER NOT NULL,
  "immeuble_id" TEXT NOT NULL,
  "dept" TEXT NOT NULL,
  "code_insee" TEXT,
  "imb_code" TEXT,
  "addr_numero" TEXT,
  "addr_nom_voie" TEXT,
  "addr_nom_commune" TEXT,
  "nbr_logements" TEXT,
  "fermeture_technique" TEXT,
  "fermeture_com_zone" TEXT,
  "fermeture_com_addr" TEXT,
  "elig_fo" TEXT,
  "annee_ft" TEXT,
  "sites_4g" INTEGER,
  "sites_5g" INTEGER,
  "sites_total" INTEGER,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "distance_meters" DOUBLE PRECISION NOT NULL,
  "opportunity_score" INTEGER NOT NULL,
  "filters_snapshot" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "acquiscan_zone_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "acquiscan_zone_targets_zone_id_immeuble_id_key"
  ON "acquiscan_zone_targets"("zone_id", "immeuble_id");

CREATE INDEX "acquiscan_zone_targets_zone_id_idx"
  ON "acquiscan_zone_targets"("zone_id");

CREATE INDEX "acquiscan_zone_targets_dept_idx"
  ON "acquiscan_zone_targets"("dept");

CREATE INDEX "acquiscan_zone_targets_code_insee_idx"
  ON "acquiscan_zone_targets"("code_insee");

CREATE INDEX "acquiscan_zone_targets_latitude_longitude_idx"
  ON "acquiscan_zone_targets"("latitude", "longitude");

CREATE INDEX "acquiscan_zone_targets_opportunity_score_idx"
  ON "acquiscan_zone_targets"("opportunity_score");

ALTER TABLE "acquiscan_zone_targets"
  ADD CONSTRAINT "acquiscan_zone_targets_zone_id_fkey"
  FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
