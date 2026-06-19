/**
 * @fileoverview Statistic API types
 */

export type {
  Statistic,
  TimelinePoint,
  OwnerActivityStatistic,
  ZoneStatistic,
  TeamLastStatusActivity,
} from '../../../types/api'

export type {
  QueryStatisticsResponse,
  QueryStatisticResponse,
  QueryZoneStatisticsResponse,
  QueryTeamLastStatusActivitiesResponse,
  QueryStatsTimelineResponse,
  QueryStatsActivityByOwnerResponse,
  CreateStatisticVariables,
  MutationCreateStatisticResponse,
  UpdateStatisticVariables,
  MutationUpdateStatisticResponse,
  MutationRemoveStatisticResponse,
  GetEntityByIdVariables,
} from '../../../types/graphql'
