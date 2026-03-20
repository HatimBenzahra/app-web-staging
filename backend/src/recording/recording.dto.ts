import { Field, ObjectType, InputType, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class RecordingResult {
  @Field() egressId: string;
  @Field() roomName: string;
  @Field() status: string;
  @Field() s3Key: string;
  @Field({ nullable: true }) url?: string;
}

@ObjectType()
export class RecordingItem {
  @Field() key: string;
  @Field({ nullable: true }) url?: string;
  @Field({ nullable: true }) size?: number;
  @Field({ nullable: true }) lastModified?: Date;
}

@ObjectType()
export class EgressState {
  @Field() egressId: string;
  @Field() status: string;
  @Field({ nullable: true }) roomName?: string;
  @Field({ nullable: true }) error?: string;
}

@InputType()
export class StartRecordingInput {
  @Field() roomName: string;
  @Field({ nullable: true, defaultValue: true })
  audioOnly?: boolean;

  @Field({ nullable: true })
  participantIdentity?: string;

  @Field({ nullable: true })
  immeubleId?: number;
}

@InputType()
export class StopRecordingInput {
  @Field() egressId: string;
}

@InputType()
export class RequestRecordingUploadInput {
  @Field() roomName: string;

  @Field({ nullable: true })
  immeubleId?: number;

  @Field({ nullable: true })
  participantIdentity?: string;

  @Field({ nullable: true, defaultValue: 'audio/mp4' })
  mimeType?: string;

  @Field({ nullable: true })
  duration?: number;

  @Field({ nullable: true })
  fileSize?: number;
}

@ObjectType()
export class RecordingUploadDetails {
  @Field() uploadUrl: string;
  @Field() s3Key: string;
  @Field() expiresIn: number;
}

@InputType()
export class ConfirmRecordingUploadInput {
  @Field() s3Key: string;

  @Field({ nullable: true })
  duration?: number;

  @Field(() => [DoorSegmentInput], { nullable: true })
  doorSegments?: DoorSegmentInput[];
}

@InputType()
export class DoorSegmentInput {
  @Field(() => Int) porteId: number;
  @Field() numero: string;
  @Field(() => Int) etage: number;
  @Field(() => Float) startTime: number;
  @Field(() => Float) endTime: number;
  @Field({ nullable: true }) statut?: string;
}

@ObjectType()
export class RecordingSegmentDto {
  @Field(() => Int) id: number;
  @Field(() => Int) porteId: number;
  @Field({ nullable: true }) porteNumero?: string;
  @Field(() => Int, { nullable: true }) porteEtage?: number;
  @Field({ nullable: true }) immeubleAdresse?: string;
  @Field({ nullable: true }) commercialNom?: string;
  @Field({ nullable: true }) s3KeySegment?: string;
  @Field({ nullable: true }) statut?: string;
  @Field(() => Float) startTime: number;
  @Field(() => Float) endTime: number;
  @Field(() => Float) durationSec: number;
  @Field({ nullable: true }) transcription?: string;
  @Field(() => Int, { nullable: true }) speechScore?: number;
  @Field() status: string;
  @Field({ nullable: true }) streamingUrl?: string;
  @Field(() => Int, { nullable: true }) immeubleId?: number;
  @Field() createdAt: Date;
}

@ObjectType()
export class ExtractionProgressDto {
  @Field() step: string;
  @Field(() => Int) current: number;
  @Field(() => Int) total: number;
}

@ObjectType()
export class ExtractionQueueItemDto {
  @Field() key: string;
  @Field() step: string;
  @Field(() => Int) current: number;
  @Field(() => Int) total: number;
}

@ObjectType()
export class PaginatedRecordingsResult {
  @Field(() => [RecordingItem]) items: RecordingItem[];
  @Field(() => Int) totalCount: number;
}

@ObjectType()
export class SpeechScoreDto {
  @Field() key: string;
  @Field(() => Int, { nullable: true }) score?: number;
  @Field(() => Float, { nullable: true }) totalDurationSec?: number;
  @Field(() => Float, { nullable: true }) speechDurationSec?: number;
  @Field() status: string;
}
