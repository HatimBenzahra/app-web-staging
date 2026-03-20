import { ObjectType, Field, Int, Float, InputType } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

@ObjectType()
export class GpsPosition {
  @Field(() => Int)
  id: number;

  @Field()
  deviceId: string;

  @Field({ nullable: true })
  deviceName?: string;

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

  @Field()
  createdAt: Date;
}

@InputType()
export class GpsPositionInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  deviceId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  deviceName?: string;

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

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;
}

@InputType()
export class SaveGpsPositionsInput {
  @Field(() => [GpsPositionInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GpsPositionInput)
  positions: GpsPositionInput[];
}

@ObjectType()
export class GpsHistoryResponse {
  @Field(() => Int)
  total: number;

  @Field(() => [GpsPosition])
  positions: GpsPosition[];
}

@ObjectType()
export class SaveGpsPositionsResponse {
  @Field()
  success: boolean;

  @Field(() => Int)
  saved: number;
}

@ObjectType()
export class DeviceMapping {
  @Field(() => Int)
  id: number;

  @Field()
  deviceId: string;

  @Field()
  commercialName: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@InputType()
export class SetDeviceCommercialInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  deviceId: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  commercialName: string;
}
