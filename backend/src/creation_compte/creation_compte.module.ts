import { Module } from '@nestjs/common';
import { CreationCompteResolver } from './creation_compte.resolver';
import { CreationCompteService } from './creation_compte.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [CreationCompteResolver, CreationCompteService, PrismaService],
  exports: [CreationCompteService],
})
export class CreationCompteModule {}
