-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ZONE_ASSIGNED', 'ZONE_UNASSIGNED');

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "userType" "UserType" NOT NULL,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "userType" "UserType" NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_userType_idx" ON "DeviceToken"("userId", "userType");

-- CreateIndex
CREATE INDEX "Notification_userId_userType_createdAt_idx" ON "Notification"("userId", "userType", "createdAt");

-- =====================================================================
-- Listener réactif sur ZoneEnCours : à chaque INSERT/DELETE, on émet un
-- NOTIFY sur le canal 'zone_en_cours_change'. NOTIFY est transactionnel
-- (délivré au COMMIT, jamais sur rollback) : pas de fausse notification si
-- l'assignation échoue. Le NotificationsListenerService (backend) écoute ce
-- canal et déclenche l'envoi du push + la persistance des Notification.
-- =====================================================================
CREATE OR REPLACE FUNCTION notify_zone_en_cours_change() RETURNS trigger AS $$
DECLARE
  payload json;
  row record;
  operation text;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    row := OLD;
    operation := 'DELETE';
  ELSE
    row := NEW;
    operation := TG_OP; -- INSERT
  END IF;

  payload := json_build_object(
    'op', operation,
    'id', row.id,
    'userId', row."userId",
    'userType', row."userType",
    'zoneId', row."zoneId"
  );

  PERFORM pg_notify('zone_en_cours_change', payload::text);
  RETURN NULL; -- AFTER trigger : la valeur de retour est ignorée
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER zone_en_cours_change_trigger
AFTER INSERT OR DELETE ON "ZoneEnCours"
FOR EACH ROW EXECUTE FUNCTION notify_zone_en_cours_change();
