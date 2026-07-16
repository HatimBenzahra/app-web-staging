import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { NotificationType, UserType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { FcmPushService } from './fcm-push.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmPush: FcmPushService,
  ) {}

  // ---------------------------------------------------------------------------
  // Tokens d'appareil
  // ---------------------------------------------------------------------------

  async registerDeviceToken(
    userId: number,
    userType: UserType,
    token: string,
    platform?: string,
  ) {
    if (typeof token !== 'string' || token.trim().length === 0) {
      throw new BadRequestException('Token push invalide');
    }
    // Upsert par token : si l'appareil change de compte, on réattribue le token.
    return this.prisma.deviceToken.upsert({
      where: { token },
      update: { userId, userType, platform },
      create: { token, userId, userType, platform },
    });
  }

  async unregisterDeviceToken(token: string): Promise<boolean> {
    await this.prisma.deviceToken.deleteMany({ where: { token } });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Centre de notifications
  // ---------------------------------------------------------------------------

  getMyNotifications(userId: number, userType: UserType, limit = 50) {
    return this.prisma.notification.findMany({
      where: { userId, userType },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  getUnreadCount(userId: number, userType: UserType) {
    return this.prisma.notification.count({
      where: { userId, userType, readAt: null },
    });
  }

  async markAsRead(id: number, userId: number, userType: UserType) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== userId || notif.userType !== userType) {
      throw new ForbiddenException('Notification introuvable');
    }
    if (notif.readAt) return notif;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: number, userType: UserType): Promise<boolean> {
    await this.prisma.notification.updateMany({
      where: { userId, userType, readAt: null },
      data: { readAt: new Date() },
    });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Réaction à un changement de ZoneEnCours (appelé par le listener LISTEN/NOTIFY)
  // ---------------------------------------------------------------------------

  /**
   * Persiste une notification et envoie le push à tous les appareils de
   * l'utilisateur concerné. `op` provient du trigger Postgres :
   * INSERT → zone assignée, DELETE → zone retirée.
   */
  async notifyZoneChange(
    op: 'INSERT' | 'DELETE',
    userId: number,
    userType: UserType,
    zoneId: number,
  ): Promise<void> {
    const type =
      op === 'INSERT'
        ? NotificationType.ZONE_ASSIGNED
        : NotificationType.ZONE_UNASSIGNED;

    // Enrichissement : nom de zone + nombre d'adresses/immeubles à prospecter.
    const zone = await this.prisma.zone.findUnique({
      where: { id: zoneId },
      select: {
        nom: true,
        _count: { select: { acquiscanTargets: true, immeubles: true } },
      },
    });

    // Une DELETE peut survenir juste après la suppression de la zone (cascade) :
    // on notifie quand même le retrait, avec un libellé de repli.
    const zoneName = zone?.nom ?? `Zone #${zoneId}`;
    const targetCount =
      zone?._count.acquiscanTargets || zone?._count.immeubles || 0;

    const title =
      type === NotificationType.ZONE_ASSIGNED
        ? 'Nouvelle zone assignée'
        : 'Zone retirée';
    const body =
      type === NotificationType.ZONE_ASSIGNED
        ? `${zoneName}${targetCount ? ` — ${targetCount} adresse(s) à prospecter` : ''}`
        : `${zoneName} ne vous est plus assignée`;
    const data = { type, zoneId, zoneName, targetCount };

    // Persistance (centre de notifications).
    await this.prisma.notification.create({
      data: { userId, userType, type, title, body, data },
    });

    // Push best-effort.
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId, userType },
      select: { token: true },
    });
    if (tokens.length === 0) return;

    await this.fcmPush.send(
      tokens.map((t) => t.token),
      { title, body, data },
      (deadToken: string) => {
        void this.unregisterDeviceToken(deadToken);
      },
    );
  }
}
