import { ObjectType, Field, Int, InputType } from '@nestjs/graphql';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Statistic } from '../statistic/statistic.dto';
import { UserStatus } from '../enumeration-Status/user-status.enum';

@ObjectType()
export class Directeur {
  @Field(() => Int)
  id: number;

  @Field()
  nom: string;

  @Field()
  prenom: string;

  @Field({ nullable: true })
  adresse?: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  numTelephone?: string;

  @Field(() => UserStatus)
  status: UserStatus;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => [Statistic], { nullable: true })
  statistics?: Statistic[];
}

@InputType()
export class CreateDirecteurInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  nom: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  prenom: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  adresse: string;

  @Field()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  numTelephone: string;

  @Field(() => UserStatus, { nullable: true })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

@InputType()
export class UpdateDirecteurInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  nom?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  prenom?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  adresse?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  numTelephone?: string;

  @Field(() => UserStatus, { nullable: true })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
