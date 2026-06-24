CREATE INDEX "acquiscan_address_coordinates_latitude_longitude_idx" ON "acquiscan_address_coordinates"("latitude", "longitude");
CREATE INDEX "acquiscan_address_coordinates_dept_latitude_longitude_idx" ON "acquiscan_address_coordinates"("dept", "latitude", "longitude");
