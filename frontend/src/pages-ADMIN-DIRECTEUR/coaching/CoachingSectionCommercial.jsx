import { useCallback, useEffect, useMemo, useState } from 'react'
import { GraduationCap, Loader2, Eye } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import CoachingService from '@/services/coaching/coaching.service'
import CoachingDetailModal from './CoachingDetailModal'
import {
  PorteStatutPill,
  parseRecordingKey,
  isInProgress,
} from './CoachingComponents'

export default function CoachingSectionCommercial({ commercialId, managerId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalAnalysis, setModalAnalysis] = useState(null)
  const [relaunching, setRelaunching] = useState(false)

  const load = useCallback(async () => {
    if (commercialId == null && managerId == null) return
    setLoading(true)
    const filter =
      commercialId != null ? { commercialId, take: 100 } : { managerId, take: 100 }
    const res = await CoachingService.analyses(filter)
    setItems(res.items || [])
    setLoading(false)
  }, [commercialId, managerId])

  useEffect(() => {
    load()
  }, [load])

  const kpis = useMemo(() => {
    const scored = items.filter((i) => typeof i.score === 'number')
    const avg = scored.length
      ? Math.round(scored.reduce((a, i) => a + i.score, 0) / scored.length)
      : null
    const by = {}
    for (const i of items) by[i.statutPorte] = (by[i.statutPorte] || 0) + 1
    return {
      total: items.length,
      avg,
      contrats: by.CONTRAT_SIGNE || 0,
      refus: by.REFUS || 0,
    }
  }, [items])

  const relaunch = async () => {
    if (!modalAnalysis) return
    setRelaunching(true)
    try {
      const updated = await CoachingService.relaunch(modalAnalysis.id)
      if (updated) setModalAnalysis(updated)
      load()
    } finally {
      setRelaunching(false)
    }
  }

  return (
    <Card className="border-border/60 bg-card">
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
            <GraduationCap className="h-4 w-4" />
          </span>
          <h3 className="text-base font-semibold">Coaching</h3>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune analyse coaching pour le moment.
          </p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                <div className="font-serif text-2xl">
                  {kpis.avg ?? '—'}
                  <span className="text-sm text-muted-foreground">/100</span>
                </div>
                <div className="text-xs text-muted-foreground">Score moyen</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                <div className="font-serif text-2xl">{kpis.total}</div>
                <div className="text-xs text-muted-foreground">Analysés</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                <div className="font-serif text-2xl text-green-600">{kpis.contrats}</div>
                <div className="text-xs text-muted-foreground">Contrats signés</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                <div className="font-serif text-2xl text-red-600">{kpis.refus}</div>
                <div className="text-xs text-muted-foreground">Refus</div>
              </div>
            </div>

            <ul className="divide-y divide-border/60">
              {items.slice(0, 8).map((a) => {
                const meta = parseRecordingKey(a.s3KeyOriginal)
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {meta.address || a.s3KeyOriginal}
                      </div>
                      <div className="mt-0.5">
                        <PorteStatutPill statut={a.statutPorte} />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums">
                        {typeof a.score === 'number'
                          ? `${Math.round(a.score)}/100`
                          : isInProgress(a.status)
                            ? '…'
                            : '—'}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setModalAnalysis(a)}
                      >
                        <Eye className="h-4 w-4" />
                        Voir
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </CardContent>

      <CoachingDetailModal
        open={!!modalAnalysis}
        onOpenChange={(o) => {
          if (!o) setModalAnalysis(null)
        }}
        analysis={modalAnalysis}
        recordingKey={modalAnalysis?.s3KeyOriginal}
        onRelaunch={relaunch}
        relaunching={relaunching}
      />
    </Card>
  )
}
