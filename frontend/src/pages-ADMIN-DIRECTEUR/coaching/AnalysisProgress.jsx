import { Check, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Avancement réel d'une analyse, étape par étape.
 *
 * États backend : PENDING → TRANSCRIBING → MAPPING (passe 0, quelles offres ont
 * été abordées) → ANALYZING (passes 1 et 2 EN PARALLÈLE : plan de vente et
 * conformité produit) → READY. On en déduit, pour chaque étape, si elle est faite,
 * en cours, ou à venir.
 *
 * CONFORMITY n'est plus jamais écrit ; il reste dans l'ordre pour que les analyses
 * antérieures, qui le portent en base, s'affichent correctement.
 */
const ORDER = ['PENDING', 'TRANSCRIBING', 'MAPPING', 'ANALYZING', 'CONFORMITY', 'READY']

const STEPS = [
  { key: 'TRANSCRIBING', label: 'Transcription de l’échange' },
  { key: 'MAPPING', label: 'Détection des offres abordées' },
  { key: 'ANALYZING', label: 'Analyse du plan de vente & conformité produit' },
]

function StepIcon({ state }) {
  const cls = 'h-3.5 w-3.5 shrink-0'
  if (state === 'done') return <Check className={cn(cls, 'text-green-600')} />
  if (state === 'current') return <Loader2 className={cn(cls, 'animate-spin text-indigo-600')} />
  if (state === 'failed') return <X className={cn(cls, 'text-red-600')} />
  return <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border/80" />
}

export default function AnalysisProgress({ analysis }) {
  if (!analysis) return null

  const rank = ORDER.indexOf(analysis.status)
  const failed = analysis.status === 'FAILED'
  const ready = analysis.status === 'READY'

  // Aucune offre présentée : la conformité produit n'a pas eu lieu. On le dit,
  // plutôt que de laisser croire qu'elle a tourné.
  const noProduct = (analysis.detectedProducts || []).length === 0

  const stateOf = stepKey => {
    if (ready) return 'done'
    const stepRank = ORDER.indexOf(stepKey)
    if (failed) return 'pending'
    if (rank < 0) return 'pending'
    // CONFORMITY (analyses antérieures) tombe dans la même ligne qu'ANALYZING :
    // les deux passes y sont désormais simultanées.
    if (stepKey === 'ANALYZING' && analysis.status === 'CONFORMITY') return 'current'
    if (stepRank < rank) return 'done'
    if (stepRank === rank) return 'current'
    return 'pending'
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <ul className="space-y-1.5">
        {STEPS.map(step => {
          const state = stateOf(step.key)
          return (
            <li key={step.key} className="flex items-center gap-2 text-sm">
              <StepIcon state={state} />
              <span
                className={cn(
                  state === 'done' && 'text-foreground',
                  state === 'current' && 'font-medium text-foreground',
                  state === 'pending' && 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
              {step.key === 'ANALYZING' && ready && noProduct && (
                <span className="text-xs text-muted-foreground">
                  — aucune offre présentée, conformité non requise
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {analysis.status === 'PENDING' && (
        <p className="mt-2 text-xs text-muted-foreground">
          En file d’attente — le traitement démarre dans quelques secondes.
        </p>
      )}
      {failed && analysis.error && (
        <p className="mt-2 text-xs text-destructive">{analysis.error}</p>
      )}
    </div>
  )
}
