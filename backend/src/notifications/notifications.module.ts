import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';
import { NotificationsListenerService } from './notifications.listener';
import { ExpoPushService } from './expo-push.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    NotificationsResolver,
    NotificationsService,
    NotificationsListenerService,
    ExpoPushService,
    PrismaService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
