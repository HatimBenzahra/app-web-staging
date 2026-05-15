import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Copy, FileText, Search } from 'lucide-react'
import { InlineEmptyState } from './CoachingShared'

const TIMESTAMP_REGEX = /^\[(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?\]\s*(.*)$/

/**
 * Full raw Whisper transcript view. Renders the session-level transcript with
 * timestamp parsing, monospace typography for findability (Ctrl+F friendly) and
 * a copy-to-clipboard shortcut.
 *
 * Each line that matches `[MM:SS-MM:SS] Text` is rendered with its timecode in
 * a dedicated column. Lines that do not match are rendered as-is so a parser
 * regression cannot break the view.
 *
 * @param {Object} props
 * @param {Object} props.session  - coaching session (uses session.transcriptText)
 */
function RawTranscriptView({ session }) {
  const transcript = session?.transcriptText || ''
  const [copied, setCopied] = React.useState(false)

  const lines = React.useMemo(() => {
    if (!transcript) return []
    return transcript
      .split('\n')
      .map(line => line.trimEnd())
      .filter(line => line.length > 0)
      .map((line, index) => {
        const match = line.match(TIMESTAMP_REGEX)
        if (!match) {
          return { id: index, raw: line, start: null, end: null, text: line, hasTimecode: false }
        }
        return {
          id: index,
          raw: line,
          start: match[1],
          end: match[2] || null,
          text: match[3] || '',
          hasTimecode: true,
        }
      })
  }, [transcript])

  const handleCopy = React.useCallback(() => {
    if (!transcript) return
    void navigator.clipboard?.writeText(transcript)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }, [transcript])

  return (
    <Card className="border-border/70">
      <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Transcript brut Whisper
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Texte intégral non retravaillé, avec timecodes d’origine. Utilisez Ctrl+F pour
            rechercher un mot.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-1 text-xs text-muted-foreground">
            <Search className="h-3 w-3" />
            Ctrl+F
          </span>
          <Button
            type="button"
            variant={copied ? 'default' : 'outline'}
            size="sm"
            onClick={handleCopy}
            disabled={!transcript}
          >
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? 'Copié' : 'Copier'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {transcript ? (
          <div className="overflow-hidden rounded-lg border border-border/70 bg-background">
            <div className="max-h-[640px] overflow-y-auto">
              <div className="divide-y divide-border/60">
                {lines.map(line => (
                  <div
                    key={line.id}
                    className="flex items-start gap-3 px-4 py-2.5 text-sm leading-6 hover:bg-muted/30"
                  >
                    {line.hasTimecode ? (
                      <span className="mt-0.5 inline-flex shrink-0 rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {line.start}
                        {line.end ? ` → ${line.end}` : null}
                      </span>
                    ) : (
                      <span
                        className="mt-0.5 inline-block h-[18px] w-[64px] shrink-0"
                        aria-hidden
                      />
                    )}
                    <p className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-foreground">
                      {line.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border/70 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
              <span className="tabular-nums">{lines.length} ligne(s)</span>
              <span>Source : sortie Whisper brute</span>
            </div>
          </div>
        ) : (
          <InlineEmptyState text="Aucun transcript brut disponible pour cette session." compact />
        )}
      </CardContent>
    </Card>
  )
}

export default React.memo(RawTranscriptView)
