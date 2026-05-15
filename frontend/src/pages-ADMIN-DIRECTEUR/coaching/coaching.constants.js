import { FileAudio, LayoutDashboard, ListChecks, Target } from 'lucide-react'

export const STATUS_LABELS = {
  PENDING: 'En attente',
  PROCESSING: 'Analyse en cours',
  COMPLETED: 'Terminé',
  FAILED: 'Échec',
  NEEDS_REVIEW: 'À vérifier',
}

export const REVIEW_LABELS = {
  NOT_REQUIRED: 'Auto-validé',
  PENDING: 'Review requise',
  VALIDATED: 'Validé',
  REJECTED: 'Rejeté',
}

export const CONVERSATION_LABELS = {
  COMPLETED: 'Évaluée',
  NEEDS_REVIEW: 'À vérifier',
  SKIPPED: 'Non exploitable',
  FAILED: 'Échec',
}

export const EXPLOITABILITY_LABELS = {
  PRIORITY: 'Prioritaire',
  GOOD: 'Correct',
  LOW_VALUE: 'Faible valeur',
  ALREADY_ANALYZED: 'Déjà analysé',
  REVIEW: 'À revoir',
}

export const QUEUE_LABELS = {
  QUEUED: 'En file',
  PROCESSING: 'En cours',
  COMPLETED: 'Terminé',
  FAILED: 'Échec',
  CANCELLED: 'Annulé',
}

export const PERIOD_OPTIONS = [
  { value: 'TODAY', label: "Aujourd'hui" },
  { value: 'LAST_7_DAYS', label: '7 derniers jours' },
  { value: 'LAST_30_DAYS', label: '30 derniers jours' },
]

export const COACHING_SECTIONS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Priorisation, queue et alertes de revue.',
    href: '/coaching/dashboard',
    icon: LayoutDashboard,
  },
  {
    key: 'recordings',
    label: 'Candidats IA',
    description: 'Prioriser les appels à analyser.',
    href: '/coaching/recordings',
    icon: FileAudio,
  },
  {
    key: 'sessions',
    label: 'Analyses',
    description: 'Historique des rapports et suivi des sessions.',
    href: '/coaching/sessions',
    icon: ListChecks,
  },
  {
    key: 'plans',
    label: 'Plans',
    description: 'Trames de vente et consignes d’évaluation.',
    href: '/coaching/plans',
    icon: Target,
  },
]
