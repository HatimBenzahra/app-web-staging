import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';
import { NotificationsListenerService } from './notifications.listener';
import { FcmPushService } from './fcm-push.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    NotificationsResolver,
    NotificationsService,
    NotificationsListenerService,
    FcmPushService,
    PrismaService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
