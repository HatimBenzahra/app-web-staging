import {
  ObjectType,
  Field,
  Int,
  InputType,
  PartialType,
  Float,
} from '@nestjs/graphql';

@ObjectType()
export class Statistic {
  @Field(() => Int)
  id: number;

  @Field(() => Int, { nullable: true })
  commercialId?: number;

  @Field(() => Int, { nullable: true })
  managerId?: number;

  @Field(() => Int, { nullable: true })
  directeurId?: number;

  @Field(() => Int, { nullable: true })
  immeubleId?: number;

  @Field(() => Int, { nullable: true })
  zoneId?: number;

  @Field(() => Int)
  contratsSignes: number;

  @Field(() => Int)
  immeublesVisites: number;

  @Field(() => Int)
  rendezVousPris: number;

  @Field(() => Int)
  refus: number;

  @Field(() => Int)
  absents: number;

  @Field(() => Int)
  argumentes: number;

  @Field(() => Int)
  nbImmeublesProspectes: number;

  @Field(() => Int)
  nbPortesProspectes: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@InputType()
export class CreateStatisticInput {
  @Field(() => Int, { nullable: true })
  commercialId?: number;

  @Field(() => Int, { nullable: true })
  managerId?: number;

  @Field(() => Int, { nullable: true })
  directeurId?: number;

  @Field(() => Int, { nullable: true })
  immeubleId?: number;

  @Field(() => Int, { nullable: true })
  zoneId?: number;

  @Field(() => Int)
  contratsSignes: number;

  @Field(() => Int)
  immeublesVisites: number;

  @Field(() => Int)
  rendezVousPris: number;

  @Field(() => Int)
  refus: number;

  @Field(() => Int)
  absents: number;

  @Field(() => Int)
  argumentes: number;

  @Field(() => Int)
  nbImmeublesProspectes: number;

  @Field(() => Int)
  nbPortesProspectes: number;
}

@InputType()
export class UpdateStatisticInput extends PartialType(CreateStatisticInput) {
  @Field(() => Int)
  id: number;
}

@ObjectType()
export class TimelinePoint {
  @Field()
  date: Date;

  @Field(() => Int)
  rdvPris: number;

  @Field(() => Int)
  portesProspectees: number;

  @Field(() => Int)
  contratsSignes: number;

  @Field(() => Int)
  refus: number;

  @Field(() => Int)
  absents: number;

  @Field(() => Int)
  argumentes: number;

  @Field(() => Int)
  repassages: number;
}

@ObjectType()
export class OwnerActivityStatistic {
  @Field(() => Int)
  userId: number;

  @Field(() => String)
  userType: string;

  @Field(() => String)
  userName: string;

  @Field(() => Int)
  contratsSignes: number;

  @Field(() => Int)
  rendezVousPris: number;

  @Field(() => Int)
  refus: number;

  @Field(() => Int)
  absents: number;

  @Field(() => Int)
  argumentes: number;

  @Field(() => Int)
  repassages: number;

  @Field(() => Int)
  nbPortesProspectes: number;

  @Field(() => Float)
  tauxConversion: number;

  @Field(() => Int)
  points: number;

  @Field({ nullable: true })
  lastActivityAt?: Date;
}

@ObjectType()
export class TeamLastStatusActivity {
  @Field(() => Int)
  userId: number;

  @Field(() => String)
  userType: string;

  @Field(() => String)
  userName: string;

  @Field(() => String)
  statut: string;

  @Field()
  changedAt: Date;

  @Field(() => Int)
  porteId: number;

  @Field(() => String)
  porteNumero: string;

  @Field(() => Int, { nullable: true })
  immeubleId?: number;

  @Field(() => String, { nullable: true })
  immeubleAdresse?: string;
}

@ObjectType()
export class ZoneStatistic {
  @Field(() => Int)
  zoneId: number;

  @Field(() => String)
  zoneName: string;

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

  @Field(() => Float)
  tauxConversion: number;

  @Field(() => Float)
  tauxSuccesRdv: number;

  @Field(() => Int)
  nombreCommerciaux: number;

  @Field(() => Float)
  performanceGlobale: number;
}
