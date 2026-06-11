-- CreateTable
CREATE TABLE "Recording" (
    "id" SERIAL NOT NULL,
    "s3Key" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "userType" "UserType" NOT NULL,
    "commercialId" INTEGER,
    "managerId" INTEGER,
    "immeubleId" INTEGER,
    "size" INTEGER,
    "lastModified" TIMESTAMP(3),
    "hasConversation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recording_s3Key_key" ON "Recording"("s3Key");

-- CreateIndex
CREATE INDEX "Recording_lastModified_idx" ON "Recording"("lastModified");

-- CreateIndex
CREATE INDEX "Recording_roomName_idx" ON "Recording"("roomName");

-- CreateIndex
CREATE INDEX "Recording_commercialId_idx" ON "Recording"("commercialId");

-- CreateIndex
CREATE INDEX "Recording_managerId_idx" ON "Recording"("managerId");

-- CreateIndex
CREATE INDEX "Recording_hasConversation_idx" ON "Recording"("hasConversation");

-- CreateIndex
CREATE INDEX "Recording_userType_lastModified_idx" ON "Recording"("userType", "lastModified");

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "Commercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;
