import { Module } from '@nestjs/common';
import { ManagerService } from './manager.service';
import { ManagerResolver } from './manager.resolver';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [ManagerResolver, ManagerService, PrismaService],
})
export class ManagerModule {}
