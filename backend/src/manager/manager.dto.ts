import { ObjectType, Field, Int, InputType } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsPhoneNumber,
  IsEnum,
} from 'class-validator';
import { Directeur } from '../directeur/directeur.dto';
import { Commercial } from '../commercial/commercial.dto';
import { Zone } from '../zone/zone.dto';
import { Immeuble } from '../immeuble/immeuble.dto';
import { Statistic } from '../statistic/statistic.dto';
import { UserStatus } from '../enumeration-Status/user-status.enum';

@ObjectType()
export class Manager {
  @Field(() => Int)
  id: number;

  @Field()
  nom: string;

  @Field()
  prenom: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  numTelephone?: string;

  @Field(() => Int, { nullable: true })
  directeurId?: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => UserStatus)
  status: UserStatus;

  @Field(() => Directeur, { nullable: true })
  directeur?: Directeur | null;

  @Field(() => [Commercial], { nullable: true })
  commercials?: Commercial[];

  @Field(() => [Zone], { nullable: true })
  zones?: Zone[];

  @Field(() => [Immeuble], { nullable: true })
  immeubles?: Immeuble[];

  @Field(() => [Statistic], { nullable: true })
  statistics?: Statistic[];

  @Field(() => [Statistic], { nullable: true })
  personalStatistics?: Statistic[];

  @Field(() => [Statistic], { nullable: true })
  teamStatistics?: Statistic[];
}

@InputType()
export class CreateManagerInput {
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
  email: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  numTelephone?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  directeurId?: number;

  @Field(() => UserStatus, { nullable: true })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

@InputType()
export class UpdateManagerInput {
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
  @IsNotEmpty()
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsPhoneNumber('TN')
  numTelephone?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  directeurId?: number;

  @Field(() => UserStatus, { nullable: true })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
