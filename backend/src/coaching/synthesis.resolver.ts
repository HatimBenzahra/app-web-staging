import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SynthesisService } from './synthesis.service';
import { CoachingSynthesisDto } from './coaching.dto';

type SubjectType = 'commercial' | 'manager';

function normalizeSubject(t: string): SubjectType {
  return t === 'manager' ? 'manager' : 'commercial';
}

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SynthesisResolver {
  constructor(private readonly synthesis: SynthesisService) {}

  @Query(() => CoachingSynthesisDto, { nullable: true })
  @Roles('admin', 'directeur')
  coachingSynthesis(
    @Args('subjectType') subjectType: string,
    @Args('subjectId', { type: () => Int }) subjectId: number,
  ): Promise<CoachingSynthesisDto | null> {
    return this.synthesis.getSynthesis(normalizeSubject(subjectType), subjectId);
  }

  @Mutation(() => CoachingSynthesisDto)
  @Roles('admin', 'directeur')
  generateCoachingSynthesis(
    @Args('subjectType') subjectType: string,
    @Args('subjectId', { type: () => Int }) subjectId: number,
  ): Promise<CoachingSynthesisDto> {
    return this.synthesis.requestGenerate(normalizeSubject(subjectType), subjectId);
  }
}
