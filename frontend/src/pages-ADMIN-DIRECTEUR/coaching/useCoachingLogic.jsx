import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { coachingApi } from '@/services/api/coaching/coaching.service'

const EMPTY_STEP = {
  titre: '',
  description: '',
  expectedSignals: '',
  poids: 20,
}

const createEmptyPlanForm = () => ({
  nom: '',
  description: '',
  versionLabel: 'Version 1',
  promptInstructions: '',
  steps: [{ ...EMPTY_STEP }],
})

const RECORDINGS_PAGE_SIZE = 20

const DEV_SALES_PLAN_TEMPLATE = {
  nom: 'Plan dev · Vente immeuble fibre',
  description:
    'Plan de vente prérempli pour tester rapidement le MVP coaching IA en staging. Il simule un échange commercial de prospection immeuble avec découverte, argumentation, objections et closing.',
  versionLabel: 'Version dev',
  promptInstructions:
    "Évalue l'appel comme un coach commercial Pro-Win. Sois concret, cite les signaux observables du transcript, distingue les étapes couvertes des étapes simplement survolées, et propose des actions d'amélioration courtes et opérationnelles.",
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

const canUseDevPrefill = () => {
  if (import.meta.env.DEV) return true
  if (typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1', 'staging.pro-win.app'].includes(window.location.hostname)
}

export function useCoachingLogic() {
  const navigate = useNavigate()
  const { sessionId } = useParams()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [plans, setPlans] = useState([])
  const [recordings, setRecordings] = useState([])
  const [recordingsTotal, setRecordingsTotal] = useState(0)
  const [recordingsPage, setRecordingsPage] = useState(1)
  const [recordingsSearch, setRecordingsSearch] = useState('')
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [activeTab, setActiveTab] = useState('analyses')
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewCommercialId, setReviewCommercialId] = useState('')
  const [planForm, setPlanForm] = useState(createEmptyPlanForm)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const offset = (recordingsPage - 1) * RECORDINGS_PAGE_SIZE
      const [nextPlans, nextRecordings, nextSessions] = await Promise.all([
        coachingApi.getSalesPlans(),
        coachingApi.getRecordingCandidates({
          limit: RECORDINGS_PAGE_SIZE,
          offset,
          search: recordingsSearch || null,
        }),
        coachingApi.getSessions(),
      ])
      setPlans(nextPlans)
      setRecordings(nextRecordings.items)
      setRecordingsTotal(nextRecordings.total)
      setSessions(nextSessions)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [recordingsPage, recordingsSearch])

  const loadSession = useCallback(async id => {
    if (!id) {
      setSelectedSession(null)
      return
    }

    try {
      const session = await coachingApi.getSession(Number(id))
      setSelectedSession(session)
      setReviewNotes(session.reviewNotes || '')
      setReviewCommercialId(session.commercialId ? String(session.commercialId) : '')
    } catch (err) {
      setError(err)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

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
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [recordings])

  const recordingsTotalPages = Math.max(1, Math.ceil(recordingsTotal / RECORDINGS_PAGE_SIZE))
  const recordingsStartIndex = (recordingsPage - 1) * RECORDINGS_PAGE_SIZE
  const recordingsEndIndex = recordingsStartIndex + recordings.length

  useEffect(() => {
    if (recordingsPage > recordingsTotalPages) {
      setRecordingsPage(recordingsTotalPages)
    }
  }, [recordingsPage, recordingsTotalPages])

  const updateRecordingsSearch = useCallback(value => {
    setRecordingsSearch(value)
    setRecordingsPage(1)
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

  const fillDevSalesPlan = useCallback(() => {
    setPlanForm({
      ...DEV_SALES_PLAN_TEMPLATE,
      steps: DEV_SALES_PLAN_TEMPLATE.steps.map(step => ({ ...step })),
    })
    setActiveTab('plans')
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
      setPlanForm(createEmptyPlanForm())
      await loadAll()
      setActiveTab('plans')
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }, [loadAll, planForm])

  const launchAnalysis = useCallback(
    async s3KeyOriginal => {
      if (!selectedPlanVersionId) return

      setSubmitting(true)
      setError(null)
      try {
        const session = await coachingApi.launchAnalysis({
          salesPlanVersionId: Number(selectedPlanVersionId),
          s3KeyOriginal,
        })
        await loadAll()
        navigate(`/coaching/sessions/${session.id}`)
        setActiveTab('analyses')
      } catch (err) {
        setError(err)
      } finally {
        setSubmitting(false)
      }
    },
    [loadAll, navigate, selectedPlanVersionId]
  )

  const openSession = useCallback(
    id => {
      navigate(`/coaching/sessions/${id}`)
      setActiveTab('analyses')
    },
    [navigate]
  )

  const relaunchSession = useCallback(
    async id => {
      setSubmitting(true)
      setError(null)
      try {
        await coachingApi.relaunchAnalysis(id)
        await loadAll()
        await loadSession(id)
      } catch (err) {
        setError(err)
      } finally {
        setSubmitting(false)
      }
    },
    [loadAll, loadSession]
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
          commercialId: reviewCommercialId ? Number(reviewCommercialId) : null,
        })
        await loadAll()
        await loadSession(selectedSession.id)
      } catch (err) {
        setError(err)
      } finally {
        setSubmitting(false)
      }
    },
    [loadAll, loadSession, reviewCommercialId, reviewNotes, selectedSession]
  )

  const planHasNamedStep = planForm.steps.some(step => step.titre.trim())

  return {
    loading,
    submitting,
    error,
    plans,
    recordings,
    recordingsTotal,
    recordingsPage,
    recordingsTotalPages,
    recordingsStartIndex,
    recordingsEndIndex,
    recordingsSearch,
    setRecordingsSearch: updateRecordingsSearch,
    goToNextRecordingsPage: () =>
      setRecordingsPage(current => Math.min(recordingsTotalPages, current + 1)),
    goToPreviousRecordingsPage: () => setRecordingsPage(current => Math.max(1, current - 1)),
    hasNextRecordingsPage: recordingsPage < recordingsTotalPages,
    hasPreviousRecordingsPage: recordingsPage > 1,
    sessions,
    selectedSession,
    isSessionDetail: Boolean(sessionId),
    activeTab,
    setActiveTab,
    planForm,
    setPlanForm,
    updateStep,
    addStep,
    duplicateStep,
    removeStep,
    planHasNamedStep,
    fillDevSalesPlan,
    canUseDevPrefill: canUseDevPrefill(),
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
    reviewCommercialId,
    setReviewCommercialId,
    commercialOptions,
    refreshAll: loadAll,
  }
}
