import { Loader2, RotateCw, Clock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import CoachingResultPanel from './CoachingResultPanel'
import {
  ScoreBar,
  StatusPill,
  QualityPill,
  PorteStatutPill,
  parseRecordingKey,
  formatDateTime,
  formatDuration,
} from './CoachingComponents'

export default function CoachingDetailModal({
  open,
  onOpenChange,
  analysis,
  recordingKey,
  onRelaunch,
  relaunching,
}) {
  if (!analysis) return null

  const meta = parseRecordingKey(analysis.s3KeyOriginal || recordingKey)
  const inProgress = ['PENDING', 'TRANSCRIBING', 'ANALYZING'].includes(analysis.status)
  const hasScore = typeof analysis.score === 'number'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl flex max-h-[92vh] flex-col gap-0 p-0 overflow-hidden">
        {/* En-tête */}
        <DialogHeader className="border-b p-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate text-lg">
                {analysis.subjectName || meta.address || 'Enregistrement'}
              </DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {meta.address && <span>{meta.address}</span>}
                <span>·</span>
                <span>{formatDateTime(meta.date)}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(analysis.transcriptDurationSec)}
                </span>
              </DialogDescription>
              {analysis.statutPorte && (
                <div className="mt-2">
                  <PorteStatutPill statut={analysis.statutPorte} />
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <StatusPill status={analysis.status} />
                <QualityPill quality={analysis.quality} />
              </div>
              <div className="text-right">
                <div className="text-3xl font-semibold leading-none">
                  {hasScore ? Math.round(analysis.score) : '—'}
                  <span className="text-base text-muted-foreground">/100</span>
                </div>
                {typeof analysis.confidence === 'number' && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    confiance {Math.round(analysis.confidence)}%
                  </div>
                )}
              </div>
            </div>
          </div>
          {hasScore && <ScoreBar value={analysis.score} className="mt-3" />}
        </DialogHeader>

        {/* Corps défilant */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <CoachingResultPanel analysis={analysis} recordingKey={recordingKey} showAudio />
        </div>

        {/* Pied */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRelaunch}
            disabled={relaunching || inProgress}
          >
            {relaunching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
            Relancer
          </Button>
          <span className="text-xs text-muted-foreground">
            {analysis.planSlug} v{analysis.planVersion}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
