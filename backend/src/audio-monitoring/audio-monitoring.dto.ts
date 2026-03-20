import {
  Field,
  ObjectType,
  InputType,
  ID,
  Int,
  GraphQLISODateTime,
  registerEnumType,
} from '@nestjs/graphql';

export enum MonitoringStatus {
  ACTIVE = 'ACTIVE',
  STOPPED = 'STOPPED',
  PAUSED = 'PAUSED',
}
registerEnumType(MonitoringStatus, { name: 'MonitoringStatus' });

@ObjectType()
export class MonitoringSession {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  userId: number;

  @Field()
  userType: string;

  @Field()
  roomName: string;

  @Field(() => MonitoringStatus)
  status: MonitoringStatus;

  @Field(() => GraphQLISODateTime)
  startedAt: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  endedAt?: Date;

  @Field(() => Int)
  supervisorId: number;

  @Field({ nullable: true })
  participantToken?: string;
}

@ObjectType()
export class LiveKitConnectionDetails {
  @Field()
  serverUrl: string;

  @Field()
  participantToken: string;

  @Field()
  roomName: string;

  @Field()
  participantName: string;
}

@InputType()
export class StartMonitoringInput {
  @Field(() => Int)
  userId: number;

  @Field()
  userType: string;

  @Field({ nullable: true })
  roomName?: string;
}

@InputType()
export class StopMonitoringInput {
  @Field(() => ID)
  sessionId: string;
}

@ObjectType()
export class ActiveRoom {
  @Field()
  roomName: string;

  @Field(() => Int)
  numParticipants: number;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => [String])
  participantNames: string[];
}
