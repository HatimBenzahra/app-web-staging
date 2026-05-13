import { gql } from '../../core/graphql'

const GET_COACHING_SALES_PLANS = `
  query CoachingSalesPlans {
    coachingSalesPlans {
      id
      nom
      description
      status
      versions {
        id
        versionNumber
        label
        status
        promptInstructions
        publishedAt
        createdAt
        updatedAt
        steps {
          id
          ordre
          titre
          description
          expectedSignals
          poids
        }
      }
    }
  }
`

const CREATE_COACHING_SALES_PLAN = `
  mutation CreateCoachingSalesPlan($input: CreateSalesPlanInput!) {
    createCoachingSalesPlan(input: $input) {
      id
      nom
      description
      status
      versions {
        id
        versionNumber
        label
        status
        promptInstructions
        publishedAt
        createdAt
        updatedAt
        steps {
          id
          ordre
          titre
          description
          expectedSignals
          poids
        }
      }
    }
  }
`

const GET_COACHING_RECORDING_CANDIDATES = `
  query CoachingRecordingCandidates($input: CoachingRecordingCandidatesInput) {
    coachingRecordingCandidates(input: $input) {
      total
      limit
      offset
      items {
        key
        roomName
        commercialId
        commercialNom
        commercialEmail
        lastModified
        size
        latestSessionId
        latestSessionStatus
      }
    }
  }
`

const GET_COACHING_SESSIONS = `
  query CoachingSessions {
    coachingSessions {
      id
      s3KeyOriginal
      roomName
      commercialId
      commercialNom
      directeurId
      salesPlanVersionId
      salesPlanNom
      salesPlanVersionLabel
      status
      reviewStatus
      confidenceScore
      identificationSource
      overallScore
      planCoverageScore
      executionQualityScore
      objectionHandlingScore
      listeningRatioScore
      closingScore
      summary
      strengths
      improvements
      recommendations
      llmModel
      failureReason
      reviewReason
      reviewNotes
      launchedAt
      processedAt
      createdAt
      updatedAt
      stepEvaluations {
        id
        ordre
        titre
        coverageStatus
        score
        verbatim
        feedback
        recommendation
      }
      conversationEvaluations {
        id
        ordre
        title
        startTime
        endTime
        transcriptText
        readableTranscriptText
        status
        reviewReason
        overallScore
        planCoverageScore
        executionQualityScore
        objectionHandlingScore
        listeningRatioScore
        closingScore
        summary
        strengths
        improvements
        recommendations
        createdAt
        updatedAt
      }
    }
  }
`

const GET_COACHING_SESSION = `
  query CoachingSession($id: Int!) {
    coachingSession(id: $id) {
      id
      s3KeyOriginal
      roomName
      commercialId
      commercialNom
      directeurId
      salesPlanVersionId
      salesPlanNom
      salesPlanVersionLabel
      status
      reviewStatus
      confidenceScore
      identificationSource
      transcriptText
      readableTranscriptText
      transcriptDurationSec
      whisperSegmentsCount
      overallScore
      planCoverageScore
      executionQualityScore
      objectionHandlingScore
      listeningRatioScore
      closingScore
      summary
      strengths
      improvements
      recommendations
      llmModel
      failureReason
      reviewReason
      reviewNotes
      audioUrl
      launchedAt
      processedAt
      createdAt
      updatedAt
      stepEvaluations {
        id
        ordre
        titre
        coverageStatus
        score
        verbatim
        feedback
        recommendation
      }
      conversationEvaluations {
        id
        ordre
        title
        startTime
        endTime
        transcriptText
        readableTranscriptText
        status
        reviewReason
        overallScore
        planCoverageScore
        executionQualityScore
        objectionHandlingScore
        listeningRatioScore
        closingScore
        summary
        strengths
        improvements
        recommendations
        createdAt
        updatedAt
      }
    }
  }
`

const LAUNCH_COACHING_ANALYSIS = `
  mutation LaunchCoachingAnalysis($input: LaunchCoachingAnalysisInput!) {
    launchCoachingAnalysis(input: $input) {
      id
      status
      reviewStatus
      salesPlanVersionId
      s3KeyOriginal
    }
  }
`

const RELAUNCH_COACHING_ANALYSIS = `
  mutation RelaunchCoachingAnalysis($id: Int!) {
    relaunchCoachingAnalysis(id: $id) {
      id
      status
      reviewStatus
      updatedAt
    }
  }
`

const REVIEW_COACHING_SESSION = `
  mutation ReviewCoachingSession($input: ReviewCoachingSessionInput!) {
    reviewCoachingSession(input: $input) {
      id
      status
      reviewStatus
      commercialId
      reviewNotes
      reviewReason
      confidenceScore
      updatedAt
    }
  }
`

export const coachingApi = {
  async getSalesPlans() {
    const response = await gql(GET_COACHING_SALES_PLANS)
    return response.coachingSalesPlans
  },

  async createSalesPlan(input) {
    const response = await gql(CREATE_COACHING_SALES_PLAN, { input })
    return response.createCoachingSalesPlan
  },

  async getRecordingCandidates(input) {
    const response = await gql(GET_COACHING_RECORDING_CANDIDATES, { input })
    return response.coachingRecordingCandidates
  },

  async getSessions() {
    const response = await gql(GET_COACHING_SESSIONS)
    return response.coachingSessions
  },

  async getSession(id) {
    const response = await gql(GET_COACHING_SESSION, { id })
    return response.coachingSession
  },

  async launchAnalysis(input) {
    const response = await gql(LAUNCH_COACHING_ANALYSIS, { input })
    return response.launchCoachingAnalysis
  },

  async relaunchAnalysis(id) {
    const response = await gql(RELAUNCH_COACHING_ANALYSIS, { id })
    return response.relaunchCoachingAnalysis
  },

  async reviewSession(input) {
    const response = await gql(REVIEW_COACHING_SESSION, { input })
    return response.reviewCoachingSession
  },
}

export default coachingApi
