import { ObjectType, Field, Int, InputType, Float, registerEnumType } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
  IsNumber,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Porte } from '../porte/porte.dto';

export enum TypeHabitat {
  IMMEUBLE = 'IMMEUBLE',
  MAISON = 'MAISON',
  PAVILLON = 'PAVILLON',
}

registerEnumType(TypeHabitat, {
  name: 'TypeHabitat',
  description: 'Type de lieu terrain prospecte',
});

@ObjectType()
export class Immeuble {
  @Field(() => Int)
  id: number;

  @Field()
  adresse: string;

  @Field(() => Float, { nullable: true })
  latitude?: number;

  @Field(() => Float, { nullable: true })
  longitude?: number;

  @Field(() => TypeHabitat)
  typeHabitat: TypeHabitat;

  @Field(() => Int)
  nbEtages: number;

  @Field(() => Int)
  nbPortesParEtage: number;

  @Field()
  ascenseurPresent: boolean;

  @Field({ nullable: true })
  digitalCode?: string;

  @Field(() => Int, { nullable: true })
  commercialId?: number;

  @Field(() => Int, { nullable: true })
  managerId?: number;

  @Field(() => Int, { nullable: true })
  zoneId?: number;

  @Field(() => Int, { nullable: true })
  quartierId?: number;

  @Field(() => Int, { nullable: true })
  nbMaisonsPrevu?: number;

  @Field(() => [Porte], { nullable: true })
  portes?: Porte[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@InputType()
export class CreateImmeubleInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  adresse: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @Field(() => TypeHabitat, { nullable: true, defaultValue: TypeHabitat.IMMEUBLE })
  @IsOptional()
  @IsEnum(TypeHabitat)
  typeHabitat?: TypeHabitat;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  nbEtages: number;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  nbPortesParEtage: number;

  @Field()
  @IsBoolean()
  ascenseurPresent: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  digitalCode?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  commercialId?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  managerId?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  zoneId?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  quartierId?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  nbMaisonsPrevu?: number;
}

@InputType()
export class UpdateImmeubleInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  adresse?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @Field(() => TypeHabitat, { nullable: true })
  @IsOptional()
  @IsEnum(TypeHabitat)
  typeHabitat?: TypeHabitat;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  nbEtages?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  nbPortesParEtage?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  ascenseurPresent?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  digitalCode?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  commercialId?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  managerId?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  zoneId?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  quartierId?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  nbMaisonsPrevu?: number;
}

@ObjectType()
export class Quartier {
  @Field(() => Int)
  id: number;

  @Field()
  nom: string;

  @Field(() => Float, { nullable: true })
  latitude?: number;

  @Field(() => Float, { nullable: true })
  longitude?: number;

  @Field(() => Int, { nullable: true })
  commercialId?: number;

  @Field(() => Int, { nullable: true })
  managerId?: number;

  @Field(() => Int, { nullable: true })
  zoneId?: number;

  @Field(() => [Immeuble], { nullable: true })
  immeubles?: Immeuble[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@InputType()
export class CreateQuartierPointInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  adresse: string;

  @Field(() => Float)
  @IsNumber()
  latitude: number;

  @Field(() => Float)
  @IsNumber()
  longitude: number;

  @Field(() => TypeHabitat)
  @IsEnum(TypeHabitat)
  typeHabitat: TypeHabitat;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  nbEtages?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  nbPortesParEtage?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  nbMaisonsPrevu?: number;
}

@InputType()
export class CreateQuartierInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  nom?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  commercialId?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  managerId?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  zoneId?: number;

  @Field(() => [CreateQuartierPointInput])
  @ValidateNested({ each: true })
  @Type(() => CreateQuartierPointInput)
  points: CreateQuartierPointInput[];
}
