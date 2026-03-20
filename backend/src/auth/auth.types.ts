import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class AuthResponse {
  @Field()
  access_token: string;

  @Field()
  refresh_token: string;

  @Field()
  expires_in: number;

  @Field({ nullable: true })
  token_type?: string;

  @Field({ nullable: true })
  scope?: string;

  @Field(() => [String])
  groups: string[];

  @Field()
  role: string;

  @Field()
  userId: number;

  @Field({ nullable: true })
  email?: string;
}

@ObjectType()
export class TokenPayload {
  @Field()
  sub: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => [String])
  groups: string[];
}
//Ajout de l'objet pour la methode me
@ObjectType()
export class UserInfo {
  @Field(() => Int)
  id: number;

  @Field()
  role: string;

  @Field()
  email: string;
}
