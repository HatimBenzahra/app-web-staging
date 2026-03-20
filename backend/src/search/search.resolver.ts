import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';
import { GlobalSearchResult } from './search.dto';

@Resolver()
export class SearchResolver {
  constructor(private readonly searchService: SearchService) {}

  @Query(() => GlobalSearchResult)
  @UseGuards(JwtAuthGuard)
  async globalSearch(
    @Args('query') query: string,
    @Args('limit', { type: () => Int, defaultValue: 5 }) limit: number,
  ): Promise<GlobalSearchResult> {
    return this.searchService.search(query, limit);
  }
}
