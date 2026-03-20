import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class SearchResultItem {
  @Field() type: string;
  @Field(() => Int) id: number;
  @Field() label: string;
  @Field({ nullable: true }) sublabel?: string;
  @Field() url: string;
}

@ObjectType()
export class SearchResultGroup {
  @Field() category: string;
  @Field(() => [SearchResultItem]) items: SearchResultItem[];
}

@ObjectType()
export class GlobalSearchResult {
  @Field(() => [SearchResultGroup]) groups: SearchResultGroup[];
  @Field(() => Int) totalCount: number;
}
