CREATE TABLE "acquiscan_address_coordinates" (
    "id" SERIAL NOT NULL,
    "immeuble_id" TEXT NOT NULL,
    "dept" TEXT NOT NULL,
    "code_insee" TEXT,
    "imb_code" TEXT,
    "addr_code" TEXT,
    "addr_numero" TEXT,
    "addr_nom_voie" TEXT,
    "addr_nom_commune" TEXT,
    "imb_x" DOUBLE PRECISION,
    "imb_y" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acquiscan_address_coordinates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "acquiscan_address_coordinates_immeuble_id_key" ON "acquiscan_address_coordinates"("immeuble_id");
CREATE INDEX "acquiscan_address_coordinates_dept_idx" ON "acquiscan_address_coordinates"("dept");
CREATE INDEX "acquiscan_address_coordinates_code_insee_idx" ON "acquiscan_address_coordinates"("code_insee");
