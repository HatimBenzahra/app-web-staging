import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { coachingApi } from '@/services/api/coaching/coaching.service'
import { useDebouncedValue } from '@/hooks/utils/useDebouncedValue'

const EMPTY_STEP = {
  titre: '',
  description: '',
  expectedSignals: '',
  poids: 20,
}

const RECORDINGS_PAGE_SIZE = 20
const SESSIONS_PAGE_SIZE = 20
const QUEUE_PAGE_SIZE = 20

const DEFAULT_SALES_PLAN_TEMPLATE = {
  nom: 'Plan de vente · Prospection immeuble fibre',
  description:
    'Plan de vente pour évaluer un échange commercial de prospection immeuble, de la découverte du besoin jusqu’à la prochaine étape.',
  versionLabel: 'Version 1',
  promptInstructions:
    "Évalue l'appel comme un coach commercial Pro-Win. Sois concret, cite les signaux observables de l'échange, distingue les étapes bien couvertes des étapes simplement survolées, et propose des actions d'amélioration courtes et opérationnelles.",
  steps: [
    {
      titre: 'Ouverture et cadrage',
      description:
        "Le commercial doit se présenter clairement, annoncer l'objectif de l'appel et obtenir l'accord pour échanger quelques minutes.",
      expectedSignals:
        'Présentation Pro-Win, ton professionnel, demande de disponibilité, cadrage simple du sujet fibre/immeuble.',
      poids: 15,
    },
    {
      titre: 'Découverte du contexte',
      description:
        "Le commercial identifie la situation actuelle de l'interlocuteur, les usages, les irritants et les décideurs impliqués.",
      expectedSignals:
        'Questions ouvertes, reformulation, recherche du besoin, identification du décisionnaire ou syndic/conseil syndical.',
      poids: 25,
    },
    {
      titre: 'Proposition de valeur',
      description:
        "Le commercial relie l'offre aux besoins exprimés et explique la valeur concrète pour les occupants ou le gestionnaire.",
      expectedSignals:
        'Bénéfices clairs, adaptation au contexte, exemples simples, absence de discours trop générique.',
      poids: 25,
    },
    {
      titre: 'Traitement des objections',
      description:
        'Le commercial accueille les objections, clarifie la vraie inquiétude et répond sans se justifier excessivement.',
      expectedSignals:
        'Objection reformulée, réponse structurée, gestion prix/délais/concurrence, maintien du dialogue.',
      poids: 20,
    },
    {
      titre: 'Closing et prochaine étape',
      description:
        'Le commercial conclut avec une action précise, datée ou attribuée, et vérifie l’accord de l’interlocuteur.',
      expectedSignals:
        'Prochaine étape explicite, rendez-vous ou envoi de document, validation finale, résumé des engagements.',
      poids: 15,
    },
  ],
}

const createDefaultPlanForm = () => ({
  ...DEFAULT_SALES_PLAN_TEMPLATE,
  steps: DEFAULT_SALES_PLAN_TEMPLATE.steps.map(step => ({ ...step })),
})

export function useCoachingLogic() {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const hasLoadedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [recordingsRefreshing, setRecordingsRefreshing] = useState(false)
  const [sessionsRefreshing, setSessionsRefreshing] = useState(false)
  const [launchingRecordingKeys, setLaunchingRecordingKeys] = useState(() => new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [plans, setPlans] = useState([])
  const [prioritizedRecordings, setPrioritizedRecordings] = useState([])
  const [recordings, setRecordings] = useState([])
  const [recordingsTotal, setRecordingsTotal] = useState(0)
  const [recordingsPage, setRecordingsPage] = useState(1)
  const [recordingsSearch, setRecordingsSearch] = useState('')
  const [recordingsCommercialId, setRecordingsCommercialId] = useState('ALL')
  const [recordingsAnalysisStatus, setRecordingsAnalysisStatus] = useState('ALL')
  const [recordingsSpeechLevel, setRecordingsSpeechLevel] = useState('ALL')
  const [dashboardPeriod, setDashboardPeriod] = useState('LAST_7_DAYS')
  const [dashboardSessions, setDashboardSessions] = useState([])
  const [dashboardSessionsTotal, setDashboardSessionsTotal] = useState(0)
  const [sessions, setSessions] = useState([])
  const [sessionsTotal, setSessionsTotal] = useState(0)
  const [sessionsPage, setSessionsPage] = useState(1)
  const [sessionsSearch, setSessionsSearch] = useState('')
  const [sessionsStatus, setSessionsStatus] = useState('ALL')
  const [sessionsReviewStatus, setSessionsReviewStatus] = useState('ALL')
  const [sessionsScoreLevel, setSessionsScoreLevel] = useState('ALL')
  const [queueState, setQueueState] = useState(null)
  const [queuePage, setQueuePage] = useState(1)
  const [selectedSession, setSelectedSession] = useState(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [planForm, setPlanForm] = useState(createDefaultPlanForm)

  const debouncedRecordingsSearch = useDebouncedValue(recordingsSearch, 300)
  const recordingsRequestRef = useRef(0)
  const coreRequestRef = useRef(0)

  const loadCore = useCallback(async () => {
    const requestId = ++coreRequestRef.current
    if (!hasLoadedRef.current) {
      setLoading(true)
    }
    setError(null)
    try {
      const [nextPlans, nextDashboardSessions] = await Promise.all([
        coachingApi.getSalesPlans(),
        coachingApi.getSessions({ limit: 20, offset: 0 }),
      ])
      if (requestId !== coreRequestRef.current) return
      setPlans(nextPlans)
      setDashboardSessions(nextDashboardSessions.items)
      setDashboardSessionsTotal(nextDashboardSessions.total)
    } catch (err) {
      if (requestId !== coreRequestRef.current) return
      setError(err)
    } finally {
      if (requestId === coreRequestRef.current) {
        hasLoadedRef.current = true
        setLoading(false)
      }
    }
  }, [])

  const loadRecordingsBlock = useCallback(async () => {
    const requestId = ++recordingsRequestRef.current
    if (hasLoadedRef.current) {
      setRecordingsRefreshing(true)
    }
    try {
      const offset = (recordingsPage - 1) * RECORDINGS_PAGE_SIZE
      const queueOffset = (queuePage - 1) * QUEUE_PAGE_SIZE
      const [nextPrioritizedRecordings, nextRecordings, nextQueueState] =
        await Promise.all([
          coachingApi.getRecordingCandidates({
            limit: 10,
            offset: 0,
            period: dashboardPeriod,
            includeLowValue: false,
          }),
          coachingApi.getRecordingCandidates({
            limit: RECORDINGS_PAGE_SIZE,
            offset,
            search: debouncedRecordingsSearch || null,
            commercialId:
              recordingsCommercialId && recordingsCommercialId !== 'ALL'
                ? Number(recordingsCommercialId)
                : null,
            analysisStatus:
              recordingsAnalysisStatus && recordingsAnalysisStatus !== 'ALL'
                ? recordingsAnalysisStatus
                : null,
            speechLevel:
              recordingsSpeechLevel && recordingsSpeechLevel !== 'ALL'
                ? recordingsSpeechLevel
                : null,
            period: 'ALL',
            includeLowValue: true,
          }),
          coachingApi.getAnalysisQueue({
            limit: QUEUE_PAGE_SIZE,
            offset: queueOffset,
          }),
        ])
      if (requestId !== recordingsRequestRef.current) return
      setPrioritizedRecordings(nextPrioritizedRecordings.items)
      setRecordings(nextRecordings.items)
      setRecordingsTotal(nextRecordings.total)
      setQueueState(nextQueueState)
    } catch (err) {
      if (requestId !== recordingsRequestRef.current) return
      setError(err)
    } finally {
      if (requestId === recordingsRequestRef.current) {
        setRecordingsRefreshing(false)
      }
    }
  }, [
    dashboardPeriod,
    debouncedRecordingsSearch,
    queuePage,
    recordingsAnalysisStatus,
    recordingsCommercialId,
    recordingsPage,
    recordingsSpeechLevel,
  ])

  const loadAll = useCallback(async () => {
    await Promise.all([loadCore(), loadRecordingsBlock()])
  }, [loadCore, loadRecordingsBlock])

  const loadSessions = useCallback(async () => {
    setSessionsRefreshing(true)
    setError(null)
    try {
      const sessionsOffset = (sessionsPage - 1) * SESSIONS_PAGE_SIZE
      const nextSessions = await coachingApi.getSessions({
        limit: SESSIONS_PAGE_SIZE,
        offset: sessionsOffset,
        search: sessionsSearch || null,
        status: sessionsStatus !== 'ALL' ? sessionsStatus : null,
        reviewStatus: sessionsReviewStatus !== 'ALL' ? sessionsReviewStatus : null,
        scoreLevel: sessionsScoreLevel !== 'ALL' ? sessionsScoreLevel : null,
      })
      setSessions(nextSessions.items)
      setSessionsTotal(nextSessions.total)
    } catch (err) {
      setError(err)
    } finally {
      setSessionsRefreshing(false)
    }
  }, [sessionsPage, sessionsReviewStatus, sessionsScoreLevel, sessionsSearch, sessionsStatus])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadAll(), loadSessions()])
  }, [loadAll, loadSessions])

  const loadSession = useCallback(async id => {
    if (!id) {
      setSelectedSession(null)
      return
    }

    try {
      const session = await coachingApi.getSession(Number(id))
      setSelectedSession(session)
      setReviewNotes(session.reviewNotes || '')
    } catch (err) {
      setError(err)
    }
  }, [])

  useEffect(() => {
    void loadCore()
  }, [loadCore])

  useEffect(() => {
    void loadRecordingsBlock()
  }, [loadRecordingsBlock])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    void loadSession(sessionId)
  }, [loadSession, sessionId])

  const publishedVersions = useMemo(() => {
    const versions = []
    for (const plan of plans) {
      for (const version of plan.versions || []) {
        if (version.status === 'PUBLISHED') {
          versions.push({
            id: version.id,
            label: `${plan.nom} · ${version.label || `v${version.versionNumber}`}`,
            planName: plan.nom,
          })
        }
      }
    }
    return versions
  }, [plans])

  const [selectedPlanVersionId, setSelectedPlanVersionId] = useState('')

  useEffect(() => {
    if (!selectedPlanVersionId && publishedVersions.length > 0) {
      setSelectedPlanVersionId(String(publishedVersions[0].id))
    }
  }, [publishedVersions, selectedPlanVersionId])

  const commercialOptions = useMemo(() => {
    const map = new Map()
    for (const recording of recordings) {
      if (recording.commercialId && recording.commercialNom) {
        map.set(recording.commercialId, {
          id: recording.commercialId,
          label: recording.commercialNom,
        })
      }
    }
    for (const session of [...sessions, ...dashboardSessions]) {
      if (session.commercialId && session.commercialNom) {
        map.set(session.commercialId, {
          id: session.commercialId,
          label: session.commercialNom,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [dashboardSessions, recordings, sessions])

  const recordingsTotalPages = Math.max(1, Math.ceil(recordingsTotal / RECORDINGS_PAGE_SIZE))
  const recordingsStartIndex = (recordingsPage - 1) * RECORDINGS_PAGE_SIZE
  const recordingsEndIndex = recordingsStartIndex + recordings.length
  const sessionsTotalPages = Math.max(1, Math.ceil(sessionsTotal / SESSIONS_PAGE_SIZE))
  const sessionsStartIndex = (sessionsPage - 1) * SESSIONS_PAGE_SIZE
  const sessionsEndIndex = sessionsStartIndex + sessions.length
  const queueTotal = queueState?.total || 0
  const queueTotalPages = Math.max(1, Math.ceil(queueTotal / QUEUE_PAGE_SIZE))
  const queueStartIndex = (queuePage - 1) * QUEUE_PAGE_SIZE
  const queueEndIndex = queueStartIndex + (queueState?.jobs?.length || 0)

  useEffect(() => {
    if (recordingsPage > recordingsTotalPages) {
      setRecordingsPage(recordingsTotalPages)
    }
  }, [recordingsPage, recordingsTotalPages])

  useEffect(() => {
    if (sessionsPage > sessionsTotalPages) {
      setSessionsPage(sessionsTotalPages)
    }
  }, [sessionsPage, sessionsTotalPages])

  useEffect(() => {
    if (queuePage > queueTotalPages) {
      setQueuePage(queueTotalPages)
    }
  }, [queuePage, queueTotalPages])

  const updateRecordingsSearch = useCallback(value => {
    setRecordingsSearch(value)
    setRecordingsPage(1)
  }, [])

  const updateRecordingsCommercialId = useCallback(value => {
    setRecordingsCommercialId(value)
    setRecordingsPage(1)
  }, [])

  const updateRecordingsAnalysisStatus = useCallback(value => {
    setRecordingsAnalysisStatus(value)
    setRecordingsPage(1)
  }, [])

  const updateRecordingsSpeechLevel = useCallback(value => {
    setRecordingsSpeechLevel(value)
    setRecordingsPage(1)
  }, [])

  const updateSessionsSearch = useCallback(value => {
    setSessionsSearch(value)
    setSessionsPage(1)
  }, [])

  const updateSessionsStatus = useCallback(value => {
    setSessionsStatus(value)
    setSessionsPage(1)
  }, [])

  const updateSessionsReviewStatus = useCallback(value => {
    setSessionsReviewStatus(value)
    setSessionsPage(1)
  }, [])

  const updateSessionsScoreLevel = useCallback(value => {
    setSessionsScoreLevel(value)
    setSessionsPage(1)
  }, [])

  const resetSessionsFilters = useCallback(() => {
    setSessionsSearch('')
    setSessionsStatus('ALL')
    setSessionsReviewStatus('ALL')
    setSessionsScoreLevel('ALL')
    setSessionsPage(1)
  }, [])

  const updateStep = useCallback((index, field, value) => {
    setPlanForm(current => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, [field]: value } : step
      ),
    }))
  }, [])

  const addStep = useCallback(() => {
    setPlanForm(current => ({
      ...current,
      steps: [...current.steps, { ...EMPTY_STEP }],
    }))
  }, [])

  const duplicateStep = useCallback(index => {
    setPlanForm(current => {
      const source = current.steps[index] || EMPTY_STEP
      return {
        ...current,
        steps: [
          ...current.steps.slice(0, index + 1),
          { ...source, titre: source.titre ? `${source.titre} copie` : '' },
          ...current.steps.slice(index + 1),
        ],
      }
    })
  }, [])

  const removeStep = useCallback(index => {
    setPlanForm(current => ({
      ...current,
      steps: current.steps.filter((_, stepIndex) => stepIndex !== index),
    }))
  }, [])

  const createPlan = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      await coachingApi.createSalesPlan({
        ...planForm,
        steps: planForm.steps.map((step, index) => ({
          ordre: index + 1,
          titre: step.titre,
          description: step.description,
          expectedSignals: step.expectedSignals,
          poids: Number(step.poids) || 20,
        })),
        publishNow: true,
      })
      setPlanForm(createDefaultPlanForm())
      await loadAll()
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }, [loadAll, planForm])

  const launchAnalysis = useCallback(
    async (s3KeyOriginal, options = {}) => {
      if (!selectedPlanVersionId || !s3KeyOriginal) return null

      setLaunchingRecordingKeys(current => new Set(current).add(s3KeyOriginal))
      setError(null)
      try {
        const session = await coachingApi.launchAnalysis({
          salesPlanVersionId: Number(selectedPlanVersionId),
          s3KeyOriginal,
        })
        if (!options.skipRefresh) {
          await refreshAll()
        }
        if (options.openAfterLaunch) {
          navigate(`/coaching/sessions/${session.id}`)
        }
        return session
      } catch (err) {
        setError(err)
        return null
      } finally {
        setLaunchingRecordingKeys(current => {
          const next = new Set(current)
          next.delete(s3KeyOriginal)
          return next
        })
      }
    },
    [navigate, refreshAll, selectedPlanVersionId]
  )

  const openSession = useCallback(
    id => {
      navigate(`/coaching/sessions/${id}`)
    },
    [navigate]
  )

  const relaunchSession = useCallback(
    async id => {
      setSubmitting(true)
      setError(null)
      try {
        await coachingApi.relaunchAnalysis(id)
        await refreshAll()
        await loadSession(id)
      } catch (err) {
        setError(err)
      } finally {
        setSubmitting(false)
      }
    },
    [loadSession, refreshAll]
  )

  const reviewSession = useCallback(
    async action => {
      if (!selectedSession) return

      setSubmitting(true)
      setError(null)
      try {
        await coachingApi.reviewSession({
          sessionId: selectedSession.id,
          action,
          reviewNotes,
        })
        await refreshAll()
        await loadSession(selectedSession.id)
      } catch (err) {
        setError(err)
      } finally {
        setSubmitting(false)
      }
    },
    [loadSession, refreshAll, reviewNotes, selectedSession]
  )

  const planHasNamedStep = planForm.steps.some(step => step.titre.trim())

  return {
    loading,
    recordingsRefreshing,
    sessionsRefreshing,
    launchingRecordingKeys,
    submitting,
    error,
    plans,
    prioritizedRecordings,
    recordings,
    recordingsTotal,
    recordingsPage,
    recordingsTotalPages,
    recordingsStartIndex,
    recordingsEndIndex,
    recordingsSearch,
    setRecordingsSearch: updateRecordingsSearch,
    recordingsCommercialId,
    setRecordingsCommercialId: updateRecordingsCommercialId,
    recordingsAnalysisStatus,
    setRecordingsAnalysisStatus: updateRecordingsAnalysisStatus,
    recordingsSpeechLevel,
    setRecordingsSpeechLevel: updateRecordingsSpeechLevel,
    dashboardPeriod,
    setDashboardPeriod,
    goToNextRecordingsPage: () =>
      setRecordingsPage(current => Math.min(recordingsTotalPages, current + 1)),
    goToPreviousRecordingsPage: () => setRecordingsPage(current => Math.max(1, current - 1)),
    hasNextRecordingsPage: recordingsPage < recordingsTotalPages,
    hasPreviousRecordingsPage: recordingsPage > 1,
    dashboardSessions,
    dashboardSessionsTotal,
    sessions,
    sessionsTotal,
    sessionsPage,
    sessionsTotalPages,
    sessionsStartIndex,
    sessionsEndIndex,
    sessionsSearch,
    setSessionsSearch: updateSessionsSearch,
    sessionsStatus,
    setSessionsStatus: updateSessionsStatus,
    sessionsReviewStatus,
    setSessionsReviewStatus: updateSessionsReviewStatus,
    sessionsScoreLevel,
    setSessionsScoreLevel: updateSessionsScoreLevel,
    resetSessionsFilters,
    goToNextSessionsPage: () =>
      setSessionsPage(current => Math.min(sessionsTotalPages, current + 1)),
    goToPreviousSessionsPage: () => setSessionsPage(current => Math.max(1, current - 1)),
    hasNextSessionsPage: sessionsPage < sessionsTotalPages,
    hasPreviousSessionsPage: sessionsPage > 1,
    queueState,
    queuePage,
    queueTotalPages,
    queueStartIndex,
    queueEndIndex,
    queueTotal,
    goToNextQueuePage: () => setQueuePage(current => Math.min(queueTotalPages, current + 1)),
    goToPreviousQueuePage: () => setQueuePage(current => Math.max(1, current - 1)),
    hasNextQueuePage: queuePage < queueTotalPages,
    hasPreviousQueuePage: queuePage > 1,
    selectedSession,
    isSessionDetail: Boolean(sessionId),
    planForm,
    setPlanForm,
    updateStep,
    addStep,
    duplicateStep,
    removeStep,
    planHasNamedStep,
    createPlan,
    selectedPlanVersionId,
    setSelectedPlanVersionId,
    publishedVersions,
    openSession,
    launchAnalysis,
    relaunchSession,
    reviewSession,
    reviewNotes,
    setReviewNotes,
    commercialOptions,
    refreshAll,
  }
}
