import { Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { S3DiagnosticsSnapshot } from './s3-diagnostics.dto';
import { S3DiagnosticsService } from './s3-diagnostics.service';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class S3DiagnosticsResolver {
  constructor(private readonly diagnostics: S3DiagnosticsService) {}

  @Query(() => S3DiagnosticsSnapshot)
  @Roles('admin')
  s3Diagnostics(): S3DiagnosticsSnapshot {
    return this.diagnostics.snapshot();
  }

  @Mutation(() => S3DiagnosticsSnapshot)
  @Roles('admin')
  resetS3Diagnostics(): S3DiagnosticsSnapshot {
    return this.diagnostics.reset();
  }
}
