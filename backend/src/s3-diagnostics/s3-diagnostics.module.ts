import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { S3DiagnosticsResolver } from './s3-diagnostics.resolver';
import { S3DiagnosticsService } from './s3-diagnostics.service';

@Module({
  providers: [S3DiagnosticsService, S3DiagnosticsResolver, PrismaService],
  exports: [S3DiagnosticsService],
})
export class S3DiagnosticsModule {}
