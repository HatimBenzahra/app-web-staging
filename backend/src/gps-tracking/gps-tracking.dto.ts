import { ObjectType, Field, Int, Float, InputType } from '@nestjs/graphql';
import { IsOptional, IsNumber, IsDate } from 'class-validator';
// UserType (enum GraphQL) est enregistre une seule fois dans zone.dto ; on le reutilise
// ici pour l'acteur polymorphe des positions GPS (meme pattern que ZoneEnCours).
import { UserType } from '../zone/zone.dto';

@ObjectType()
export class GpsPosition {
  @Field(() => Int)
  id: number;

  // Acteur polymorphe : nullable pour les anciennes lignes kiosk (deviceId sans acteur).
  @Field(() => Int, { nullable: true })
  userId?: number;

  @Field(() => UserType, { nullable: true })
  userType?: UserType;

  @Field(() => Float)
  latitude: number;

  @Field(() => Float)
  longitude: number;

  @Field(() => Float, { nullable: true })
  accuracy?: number;

  @Field(() => Int, { nullable: true })
  batteryLevel?: number;

  @Field()
  isOnline: boolean;

  @Field()
  recordedAt: Date;
}

// Position remontee par l'app mobile. L'identite de l'acteur (userId/userType) n'est
// JAMAIS acceptee du client : elle est derivee du token cote resolveur (reportMyPositions).
@InputType()
export class ReportPositionInput {
  @Field(() => Float)
  @IsNumber()
  latitude: number;

  @Field(() => Float)
  @IsNumber()
  longitude: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  batteryLevel?: number;

  // Horodatage client optionnel ; le serveur applique now() si absent.
  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  recordedAt?: Date;
}
