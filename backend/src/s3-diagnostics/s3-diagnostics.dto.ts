import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class S3DiagnosticOperation {
  @Field()
  source: string;

  @Field()
  operation: string;

  @Field()
  command: string;

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  succeeded: number;

  @Field(() => Int)
  failed: number;

  @Field(() => Int, { nullable: true })
  lastDurationMs?: number;

  @Field({ nullable: true })
  lastAt?: Date;
}

@ObjectType()
export class S3DiagnosticsSnapshot {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  succeeded: number;

  @Field(() => Int)
  failed: number;

  @Field({ nullable: true })
  startedAt?: Date;

  @Field({ nullable: true })
  updatedAt?: Date;

  @Field(() => [S3DiagnosticOperation])
  operations: S3DiagnosticOperation[];
}
