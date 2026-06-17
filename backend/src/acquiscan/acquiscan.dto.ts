import { Field, Float, GraphQLISODateTime, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

@InputType()
export class AcquiscanAddressesInput {
  @Field()
  @IsString()
  @Matches(/^(\d{2,3}|2A|2B)$/i)
  dept: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/)
  commune?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^(all|current|future|\d{4})$/)
  annee?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'yes', 'no'])
  fiber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'eleve', 'moyen', 'faible'])
  coverage4g?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'eleve', 'moyen', 'faible'])
  coverage5g?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'urgent', 'chaud', 'tiede', 'froid'])
  segment?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @Field({ nullable: true })
  @IsOptional()
  enrichCoordinates?: boolean;
}

@ObjectType()
export class AcquiscanCoordinate {
  @Field(() => Float, { nullable: true })
  latitude?: number | null;

  @Field(() => Float, { nullable: true })
  longitude?: number | null;

  @Field(() => Float, { nullable: true })
  imbX?: number | null;

  @Field(() => Float, { nullable: true })
  imbY?: number | null;
}

@ObjectType()
export class AcquiscanAddress {
  @Field()
  immeubleId: string;

  @Field(() => String, { nullable: true })
  imbCode?: string | null;

  @Field(() => String, { nullable: true })
  addrNumero?: string | null;

  @Field(() => String, { nullable: true })
  addrNomVoie?: string | null;

  @Field(() => String, { nullable: true })
  addrNomCommune?: string | null;

  @Field(() => String, { nullable: true })
  codeInsee?: string | null;

  @Field(() => String, { nullable: true })
  nbrLogements?: string | null;

  @Field(() => String, { nullable: true })
  fermetureTechnique?: string | null;

  @Field(() => String, { nullable: true })
  fermetureComZone?: string | null;

  @Field(() => String, { nullable: true })
  fermetureComAddr?: string | null;

  @Field(() => String, { nullable: true })
  eligFo?: string | null;

  @Field(() => String, { nullable: true })
  anneeFt?: string | null;

  @Field(() => Int, { nullable: true })
  sites4g?: number | null;

  @Field(() => Int, { nullable: true })
  sites5g?: number | null;

  @Field(() => Int, { nullable: true })
  sitesTotal?: number | null;

  @Field(() => AcquiscanCoordinate, { nullable: true })
  coordinates?: AcquiscanCoordinate | null;
}

@ObjectType()
export class AcquiscanImportStatus {
  @Field()
  dept: string;

  @Field()
  isImported: boolean;

  @Field()
  importedCount: number;

  @Field(() => GraphQLISODateTime, { nullable: true })
  importedAt?: Date | null;
}

@ObjectType()
export class AcquiscanAddressesPage {
  @Field(() => [AcquiscanAddress])
  rows: AcquiscanAddress[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  enrichedCount: number;

  @Field(() => AcquiscanImportStatus)
  importStatus: AcquiscanImportStatus;
}
