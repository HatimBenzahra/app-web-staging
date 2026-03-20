-- CreateEnum
CREATE TYPE "StatutPorte" AS ENUM ('NON_VISITE', 'CONTRAT_SIGNE', 'REFUS', 'RENDEZ_VOUS_PRIS', 'ABSENT', 'ARGUMENTE', 'NECESSITE_REPASSAGE');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('COMMERCIAL', 'MANAGER', 'DIRECTEUR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIF', 'CONTRAT_FINIE', 'UTILISATEUR_TEST');

-- CreateEnum
CREATE TYPE "BadgeCategory" AS ENUM ('PROGRESSION', 'PRODUIT', 'PERFORMANCE', 'TROPHEE');

-- CreateEnum
CREATE TYPE "RankPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SegmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Directeur" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "adresse" TEXT,
    "email" TEXT,
    "numTelephone" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Directeur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manager" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT,
    "numTelephone" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIF',
    "winleadPlusId" TEXT,
    "directeurId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commercial" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT,
    "numTel" TEXT,
    "age" INTEGER,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIF',
    "winleadPlusId" TEXT,
    "managerId" INTEGER,
    "directeurId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "xOrigin" DOUBLE PRECISION NOT NULL,
    "yOrigin" DOUBLE PRECISION NOT NULL,
    "rayon" DOUBLE PRECISION NOT NULL,
    "directeurId" INTEGER,
    "managerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Immeuble" (
    "id" SERIAL NOT NULL,
    "adresse" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "nbEtages" INTEGER NOT NULL,
    "nbPortesParEtage" INTEGER NOT NULL,
    "ascenseurPresent" BOOLEAN NOT NULL DEFAULT false,
    "digitalCode" TEXT,
    "commercialId" INTEGER,
    "managerId" INTEGER,
    "zoneId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Immeuble_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statistic" (
    "id" SERIAL NOT NULL,
    "commercialId" INTEGER,
    "managerId" INTEGER,
    "directeurId" INTEGER,
    "immeubleId" INTEGER,
    "zoneId" INTEGER,
    "contratsSignes" INTEGER NOT NULL,
    "immeublesVisites" INTEGER NOT NULL,
    "rendezVousPris" INTEGER NOT NULL,
    "refus" INTEGER NOT NULL,
    "absents" INTEGER NOT NULL DEFAULT 0,
    "argumentes" INTEGER NOT NULL DEFAULT 0,
    "nbImmeublesProspectes" INTEGER NOT NULL,
    "nbPortesProspectes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Statistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Porte" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "nomPersonnalise" TEXT,
    "etage" INTEGER NOT NULL,
    "immeubleId" INTEGER NOT NULL,
    "statut" "StatutPorte" NOT NULL DEFAULT 'NON_VISITE',
    "nbRepassages" INTEGER NOT NULL DEFAULT 0,
    "nbContrats" INTEGER NOT NULL DEFAULT 1,
    "rdvDate" TIMESTAMP(3),
    "rdvTime" TEXT,
    "commentaire" TEXT,
    "derniereVisite" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Porte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneEnCours" (
    "id" SERIAL NOT NULL,
    "zoneId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "userType" "UserType" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoneEnCours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoriqueZone" (
    "id" SERIAL NOT NULL,
    "zoneId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "userType" "UserType" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "unassignedAt" TIMESTAMP(3) NOT NULL,
    "totalContratsSignes" INTEGER NOT NULL DEFAULT 0,
    "totalImmeublesVisites" INTEGER NOT NULL DEFAULT 0,
    "totalRendezVousPris" INTEGER NOT NULL DEFAULT 0,
    "totalRefus" INTEGER NOT NULL DEFAULT 0,
    "totalImmeublesProspectes" INTEGER NOT NULL DEFAULT 0,
    "totalPortesProspectes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HistoriqueZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistorique" (
    "id" SERIAL NOT NULL,
    "porteId" INTEGER NOT NULL,
    "commercialId" INTEGER,
    "managerId" INTEGER,
    "statut" "StatutPorte" NOT NULL,
    "commentaire" TEXT,
    "rdvDate" TIMESTAMP(3),
    "rdvTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistorique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offre" (
    "id" SERIAL NOT NULL,
    "externalId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "categorie" TEXT NOT NULL,
    "fournisseur" TEXT NOT NULL,
    "logoUrl" TEXT,
    "prixBase" DOUBLE PRECISION,
    "features" JSONB,
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "points" INTEGER NOT NULL DEFAULT 0,
    "badgeProductKey" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeDefinition" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "category" "BadgeCategory" NOT NULL,
    "iconUrl" TEXT,
    "condition" JSONB,
    "tier" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BadgeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialBadge" (
    "id" SERIAL NOT NULL,
    "commercialId" INTEGER,
    "managerId" INTEGER,
    "badgeDefinitionId" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "CommercialBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankSnapshot" (
    "id" SERIAL NOT NULL,
    "commercialId" INTEGER,
    "managerId" INTEGER,
    "period" "RankPeriod" NOT NULL,
    "periodKey" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "contratsSignes" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratValide" (
    "id" SERIAL NOT NULL,
    "externalContratId" INTEGER NOT NULL,
    "externalProspectId" INTEGER NOT NULL,
    "commercialWinleadPlusId" TEXT NOT NULL,
    "commercialId" INTEGER,
    "managerId" INTEGER,
    "offreExternalId" INTEGER,
    "offreId" INTEGER,
    "dateValidation" TIMESTAMP(3) NOT NULL,
    "dateSignature" TIMESTAMP(3),
    "periodDay" TEXT NOT NULL,
    "periodWeek" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "periodQuarter" TEXT NOT NULL,
    "periodYear" TEXT NOT NULL,
    "metadata" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContratValide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingSegment" (
    "id" SERIAL NOT NULL,
    "porteId" INTEGER NOT NULL,
    "commercialId" INTEGER,
    "managerId" INTEGER,
    "immeubleId" INTEGER,
    "statut" "StatutPorte",
    "s3KeyOriginal" TEXT NOT NULL,
    "s3KeySegment" TEXT,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "transcription" TEXT,
    "speechScore" INTEGER,
    "status" "SegmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordingSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GpsPosition" (
    "id" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "batteryLevel" INTEGER,
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GpsPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Directeur_email_key" ON "Directeur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Manager_email_key" ON "Manager"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Manager_winleadPlusId_key" ON "Manager"("winleadPlusId");

-- CreateIndex
CREATE UNIQUE INDEX "Commercial_email_key" ON "Commercial"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Commercial_winleadPlusId_key" ON "Commercial"("winleadPlusId");

-- CreateIndex
CREATE UNIQUE INDEX "Porte_immeubleId_numero_key" ON "Porte"("immeubleId", "numero");

-- CreateIndex
CREATE INDEX "ZoneEnCours_zoneId_idx" ON "ZoneEnCours"("zoneId");

-- CreateIndex
CREATE INDEX "ZoneEnCours_userId_userType_idx" ON "ZoneEnCours"("userId", "userType");

-- CreateIndex
CREATE UNIQUE INDEX "ZoneEnCours_userId_userType_key" ON "ZoneEnCours"("userId", "userType");

-- CreateIndex
CREATE INDEX "HistoriqueZone_zoneId_idx" ON "HistoriqueZone"("zoneId");

-- CreateIndex
CREATE INDEX "HistoriqueZone_userId_userType_idx" ON "HistoriqueZone"("userId", "userType");

-- CreateIndex
CREATE INDEX "HistoriqueZone_assignedAt_unassignedAt_idx" ON "HistoriqueZone"("assignedAt", "unassignedAt");

-- CreateIndex
CREATE INDEX "StatusHistorique_porteId_idx" ON "StatusHistorique"("porteId");

-- CreateIndex
CREATE INDEX "StatusHistorique_commercialId_idx" ON "StatusHistorique"("commercialId");

-- CreateIndex
CREATE INDEX "StatusHistorique_managerId_idx" ON "StatusHistorique"("managerId");

-- CreateIndex
CREATE INDEX "StatusHistorique_createdAt_idx" ON "StatusHistorique"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Offre_externalId_key" ON "Offre"("externalId");

-- CreateIndex
CREATE INDEX "Offre_categorie_idx" ON "Offre"("categorie");

-- CreateIndex
CREATE INDEX "Offre_fournisseur_idx" ON "Offre"("fournisseur");

-- CreateIndex
CREATE INDEX "Offre_isActive_idx" ON "Offre"("isActive");

-- CreateIndex
CREATE INDEX "Offre_badgeProductKey_idx" ON "Offre"("badgeProductKey");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeDefinition_code_key" ON "BadgeDefinition"("code");

-- CreateIndex
CREATE INDEX "BadgeDefinition_category_idx" ON "BadgeDefinition"("category");

-- CreateIndex
CREATE INDEX "BadgeDefinition_isActive_idx" ON "BadgeDefinition"("isActive");

-- CreateIndex
CREATE INDEX "CommercialBadge_commercialId_idx" ON "CommercialBadge"("commercialId");

-- CreateIndex
CREATE INDEX "CommercialBadge_managerId_idx" ON "CommercialBadge"("managerId");

-- CreateIndex
CREATE INDEX "CommercialBadge_badgeDefinitionId_idx" ON "CommercialBadge"("badgeDefinitionId");

-- CreateIndex
CREATE INDEX "CommercialBadge_awardedAt_idx" ON "CommercialBadge"("awardedAt");

-- CreateIndex
CREATE INDEX "CommercialBadge_periodKey_idx" ON "CommercialBadge"("periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialBadge_commercialId_badgeDefinitionId_periodKey_key" ON "CommercialBadge"("commercialId", "badgeDefinitionId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialBadge_managerId_badgeDefinitionId_periodKey_key" ON "CommercialBadge"("managerId", "badgeDefinitionId", "periodKey");

-- CreateIndex
CREATE INDEX "RankSnapshot_period_periodKey_idx" ON "RankSnapshot"("period", "periodKey");

-- CreateIndex
CREATE INDEX "RankSnapshot_commercialId_idx" ON "RankSnapshot"("commercialId");

-- CreateIndex
CREATE INDEX "RankSnapshot_managerId_idx" ON "RankSnapshot"("managerId");

-- CreateIndex
CREATE INDEX "RankSnapshot_rank_idx" ON "RankSnapshot"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "RankSnapshot_commercialId_period_periodKey_key" ON "RankSnapshot"("commercialId", "period", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "RankSnapshot_managerId_period_periodKey_key" ON "RankSnapshot"("managerId", "period", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "ContratValide_externalContratId_key" ON "ContratValide"("externalContratId");

-- CreateIndex
CREATE INDEX "ContratValide_commercialId_idx" ON "ContratValide"("commercialId");

-- CreateIndex
CREATE INDEX "ContratValide_managerId_idx" ON "ContratValide"("managerId");

-- CreateIndex
CREATE INDEX "ContratValide_commercialWinleadPlusId_idx" ON "ContratValide"("commercialWinleadPlusId");

-- CreateIndex
CREATE INDEX "ContratValide_offreId_idx" ON "ContratValide"("offreId");

-- CreateIndex
CREATE INDEX "ContratValide_dateValidation_idx" ON "ContratValide"("dateValidation");

-- CreateIndex
CREATE INDEX "ContratValide_periodDay_idx" ON "ContratValide"("periodDay");

-- CreateIndex
CREATE INDEX "ContratValide_periodWeek_idx" ON "ContratValide"("periodWeek");

-- CreateIndex
CREATE INDEX "ContratValide_periodMonth_idx" ON "ContratValide"("periodMonth");

-- CreateIndex
CREATE INDEX "ContratValide_periodQuarter_idx" ON "ContratValide"("periodQuarter");

-- CreateIndex
CREATE INDEX "ContratValide_periodYear_idx" ON "ContratValide"("periodYear");

-- CreateIndex
CREATE INDEX "RecordingSegment_porteId_idx" ON "RecordingSegment"("porteId");

-- CreateIndex
CREATE INDEX "RecordingSegment_commercialId_idx" ON "RecordingSegment"("commercialId");

-- CreateIndex
CREATE INDEX "RecordingSegment_immeubleId_idx" ON "RecordingSegment"("immeubleId");

-- CreateIndex
CREATE INDEX "RecordingSegment_s3KeyOriginal_idx" ON "RecordingSegment"("s3KeyOriginal");

-- CreateIndex
CREATE INDEX "RecordingSegment_status_idx" ON "RecordingSegment"("status");

-- CreateIndex
CREATE INDEX "GpsPosition_deviceId_idx" ON "GpsPosition"("deviceId");

-- CreateIndex
CREATE INDEX "GpsPosition_recordedAt_idx" ON "GpsPosition"("recordedAt");

-- CreateIndex
CREATE INDEX "GpsPosition_deviceId_recordedAt_idx" ON "GpsPosition"("deviceId", "recordedAt");

-- AddForeignKey
ALTER TABLE "Manager" ADD CONSTRAINT "Manager_directeurId_fkey" FOREIGN KEY ("directeurId") REFERENCES "Directeur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commercial" ADD CONSTRAINT "Commercial_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commercial" ADD CONSTRAINT "Commercial_directeurId_fkey" FOREIGN KEY ("directeurId") REFERENCES "Directeur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_directeurId_fkey" FOREIGN KEY ("directeurId") REFERENCES "Directeur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immeuble" ADD CONSTRAINT "Immeuble_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "Commercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immeuble" ADD CONSTRAINT "Immeuble_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immeuble" ADD CONSTRAINT "Immeuble_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statistic" ADD CONSTRAINT "Statistic_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "Commercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statistic" ADD CONSTRAINT "Statistic_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statistic" ADD CONSTRAINT "Statistic_directeurId_fkey" FOREIGN KEY ("directeurId") REFERENCES "Directeur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statistic" ADD CONSTRAINT "Statistic_immeubleId_fkey" FOREIGN KEY ("immeubleId") REFERENCES "Immeuble"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statistic" ADD CONSTRAINT "Statistic_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Porte" ADD CONSTRAINT "Porte_immeubleId_fkey" FOREIGN KEY ("immeubleId") REFERENCES "Immeuble"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneEnCours" ADD CONSTRAINT "ZoneEnCours_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueZone" ADD CONSTRAINT "HistoriqueZone_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistorique" ADD CONSTRAINT "StatusHistorique_porteId_fkey" FOREIGN KEY ("porteId") REFERENCES "Porte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistorique" ADD CONSTRAINT "StatusHistorique_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "Commercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistorique" ADD CONSTRAINT "StatusHistorique_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialBadge" ADD CONSTRAINT "CommercialBadge_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "Commercial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialBadge" ADD CONSTRAINT "CommercialBadge_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialBadge" ADD CONSTRAINT "CommercialBadge_badgeDefinitionId_fkey" FOREIGN KEY ("badgeDefinitionId") REFERENCES "BadgeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankSnapshot" ADD CONSTRAINT "RankSnapshot_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "Commercial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankSnapshot" ADD CONSTRAINT "RankSnapshot_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratValide" ADD CONSTRAINT "ContratValide_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "Commercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratValide" ADD CONSTRAINT "ContratValide_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratValide" ADD CONSTRAINT "ContratValide_offreId_fkey" FOREIGN KEY ("offreId") REFERENCES "Offre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSegment" ADD CONSTRAINT "RecordingSegment_porteId_fkey" FOREIGN KEY ("porteId") REFERENCES "Porte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

