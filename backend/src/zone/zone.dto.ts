import { ObjectType, Field, Int, InputType, Float, registerEnumType } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
} from 'class-validator';
import { Immeuble } from '../immeuble/immeuble.dto';

export enum UserType {
  COMMERCIAL = 'COMMERCIAL',
  MANAGER = 'MANAGER',
  DIRECTEUR = 'DIRECTEUR',
}

registerEnumType(UserType, {
  name: 'UserType',
  description: 'Type d\'utilisateur pouvant être assigné à une zone',
});

@ObjectType()
export class Zone {
  @Field(() => Int)
  id: number;

  @Field()
  nom: string;

  @Field(() => Float)
  xOrigin: number;

  @Field(() => Float)
  yOrigin: number;

  @Field(() => Float)
  rayon: number;

  @Field(() => Int, { nullable: true })
  directeurId?: number | null;

  @Field(() => Int, { nullable: true })
  managerId?: number | null;

  @Field(() => [Immeuble], { nullable: true })
  immeubles?: Immeuble[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@InputType()
export class CreateZoneInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  nom: string;

  @Field(() => Float)
  @IsNumber()
  xOrigin: number;

  @Field(() => Float)
  @IsNumber()
  yOrigin: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  rayon: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  directeurId?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  managerId?: number;
}

@InputType()
export class UpdateZoneInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  nom?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  xOrigin?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  yOrigin?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rayon?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  directeurId?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  managerId?: number;
}

@ObjectType()
export class ZoneEnCours {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  zoneId: number;

  @Field(() => Int)
  userId: number;

  @Field(() => UserType)
  userType: UserType;

  @Field()
  assignedAt: Date;

  @Field(() => Zone, { nullable: true })
  zone?: Zone;
}

@ObjectType()
export class HistoriqueZone {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  zoneId: number;

  @Field(() => Int)
  userId: number;

  @Field(() => UserType)
  userType: UserType;

  @Field()
  assignedAt: Date;

  @Field()
  unassignedAt: Date;

  @Field(() => Int)
  totalContratsSignes: number;

  @Field(() => Int)
  totalImmeublesVisites: number;

  @Field(() => Int)
  totalRendezVousPris: number;

  @Field(() => Int)
  totalRefus: number;

  @Field(() => Int)
  totalImmeublesProspectes: number;

  @Field(() => Int)
  totalPortesProspectes: number;

  @Field(() => Zone, { nullable: true })
  zone?: Zone;
}

@InputType()
export class AssignZoneInput {
  @Field(() => Int)
  @IsNumber()
  zoneId: number;

  @Field(() => Int)
  @IsNumber()
  userId: number;

  @Field(() => UserType)
  @IsEnum(UserType)
  userType: UserType;
}
