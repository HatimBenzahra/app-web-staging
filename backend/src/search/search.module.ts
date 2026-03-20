import { Module } from '@nestjs/common';
import { SearchResolver } from './search.resolver';
import { SearchService } from './search.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [SearchResolver, SearchService, PrismaService],
})
export class SearchModule {}
