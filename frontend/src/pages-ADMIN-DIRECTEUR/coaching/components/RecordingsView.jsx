import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Check, CheckCircle2, Clock3, Eye, Loader2, Minus, PlayCircle } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { EXPLOITABILITY_LABELS, STATUS_LABELS } from '../coaching.constants'
import {
  formatDate,
  formatDuration,
  formatSize,
  getRecordingAnalysisStatus,
  numberOrZero,
} from '../coaching.utils'
import { TableFrame, ToneBadge } from './CoachingShared'

export default function RecordingsView({ logic }) {
  const isRefreshing = logic.recordingsRefreshing
  const [readinessFilter, setReadinessFilter] = React.useState('ALL')
  const [selectedKeys, setSelectedKeys] = React.useState(() => new Set())
  const [bulkLaunching, setBulkLaunching] = React.useState(false)
  const skeletonRows = ['candidate-1', 'candidate-2', 'candidate-3', 'candidate-4', 'candidate-5']
  const visibleRecordings = React.useMemo(
    () =>
      readinessFilter === 'READY'
        ? logic.recordings.filter(
            recording => getRecordingAnalysisStatus(recording, logic).canLaunch
          )
        : logic.recordings,
    [logic, readinessFilter]
  )
  const selectableRecordings = React.useMemo(
    () =>
      visibleRecordings.filter(recording => getRecordingAnalysisStatus(recording, logic).canLaunch),
    [logic, visibleRecordings]
  )
  const selectedRecordings = React.useMemo(
    () => selectableRecordings.filter(recording => selectedKeys.has(recording.key)),
    [selectableRecordings, selectedKeys]
  )
  const allSelected =
    selectableRecordings.length > 0 &&
    selectableRecordings.every(recording => selectedKeys.has(recording.key))
  const someSelected = selectedRecordings.length > 0 && !allSelected

  React.useEffect(() => {
    setSelectedKeys(current => {
      const visibleKeys = new Set(selectableRecordings.map(recording => recording.key))
      const next = new Set([...current].filter(key => visibleKeys.has(key)))
      return next.size === current.size ? current : next
    })
  }, [selectableRecordings])

  const toggleRecording = React.useCallback(key => {
    setSelectedKeys(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleAll = React.useCallback(() => {
    setSelectedKeys(current => {
      if (allSelected) return new Set()
      const next = new Set(current)
      selectableRecordings.forEach(recording => next.add(recording.key))
      return next
    })
  }, [allSelected, selectableRecordings])

  const clearSelection = React.useCallback(() => setSelectedKeys(new Set()), [])

  const launchSelected = React.useCallback(async () => {
    if (selectedRecordings.length === 0) return
    if (
      selectedRecordings.length > 1 &&
      !window.confirm(`Lancer ${selectedRecordings.length} analyses coaching ?`)
    ) {
      return
    }

    setBulkLaunching(true)
    try {
      for (const recording of selectedRecordings) {
        await logic.launchAnalysis(recording.key, { skipRefresh: true })
      }
      await logic.refreshAll()
      clearSelection()
    } finally {
      setBulkLaunching(false)
    }
  }, [clearSelection, logic, selectedRecordings])

  return (
    <Card className="mx-auto w-full max-w-[1500px] border-border/70">
      <CardHeader className="gap-4">
        <div className="space-y-1">
          <CardTitle>Candidats IA à analyser</CardTitle>
          <CardDescription>
            Liste priorisée pour choisir les appels exploitables et lancer une analyse coaching.
          </CardDescription>
        </div>
        <div className="rounded-lg border border-border/70 bg-muted/15 p-4">
          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr_0.8fr_0.8fr_0.8fr]">
            <div>
              <Label htmlFor="recordings-search">Recherche</Label>
              <Input
                id="recordings-search"
                value={logic.recordingsSearch}
                onChange={event => logic.setRecordingsSearch(event.target.value)}
                placeholder="Commercial, adresse, fichier..."
                className="mt-2 bg-background"
              />
            </div>
            <div>
              <Label>Commercial</Label>
              <Select
                value={logic.recordingsCommercialId}
                onValueChange={logic.setRecordingsCommercialId}
              >
                <SelectTrigger className="mt-2 bg-background">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les commerciaux</SelectItem>
                  {logic.commercialOptions.map(commercial => (
                    <SelectItem key={commercial.id} value={String(commercial.id)}>
                      {commercial.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Analyse</Label>
              <Select
                value={logic.recordingsAnalysisStatus}
                onValueChange={logic.setRecordingsAnalysisStatus}
              >
                <SelectTrigger className="mt-2 bg-background">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous statuts</SelectItem>
                  <SelectItem value="QUEUED">En file</SelectItem>
                  <SelectItem value="PROCESSING">En cours</SelectItem>
                  <SelectItem value="COMPLETED">Terminés</SelectItem>
                  <SelectItem value="FAILED">Échecs</SelectItem>
                  <SelectItem value="NEEDS_REVIEW">À vérifier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Parole</Label>
              <Select
                value={logic.recordingsSpeechLevel}
                onValueChange={logic.setRecordingsSpeechLevel}
              >
                <SelectTrigger className="mt-2 bg-background">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous niveaux</SelectItem>
                  <SelectItem value="HIGH">Forte parole</SelectItem>
                  <SelectItem value="MEDIUM">Parole moyenne</SelectItem>
                  <SelectItem value="LOW">Faible parole</SelectItem>
                  <SelectItem value="PENDING">En calcul</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Disponibilité</Label>
              <Select value={readinessFilter} onValueChange={setReadinessFilter}>
                <SelectTrigger className="mt-2 bg-background">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous</SelectItem>
                  <SelectItem value="READY">Prêts à analyser</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            {isRefreshing
              ? 'Chargement des candidats...'
              : `${visibleRecordings.length} candidat(s) affiché(s) sur ${logic.recordingsTotal}`}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {selectedRecordings.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium">
                {selectedRecordings.length} enregistrement(s) sélectionné(s)
              </div>
              <div className="text-xs text-muted-foreground">
                Seuls les candidats prêts à analyser peuvent être sélectionnés.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
                Désélectionner
              </Button>
              <Button type="button" size="sm" onClick={launchSelected} disabled={bulkLaunching}>
                {bulkLaunching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                Lancer la sélection
              </Button>
            </div>
          </div>
        ) : null}
        <TableFrame className="max-w-none">
          <Table className="min-w-[1380px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectionButton
                    checked={allSelected}
                    indeterminate={someSelected}
                    disabled={selectableRecordings.length === 0 || isRefreshing}
                    onClick={toggleAll}
                    label="Tout sélectionner"
                  />
                </TableHead>
                <TableHead>Commercial</TableHead>
                <TableHead>Durée</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Parole</TableHead>
                <TableHead>Exploitabilité</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Dernière analyse</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRefreshing
                ? skeletonRows.map(row => (
                    <TableRow key={row}>
                      <TableCell>
                        <Skeleton className="h-4 w-4 rounded-md" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="mt-2 h-3 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-72" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-24 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-9 w-24" />
                      </TableCell>
                    </TableRow>
                  ))
                : visibleRecordings.map(recording => {
                    const rowStatus = getRecordingAnalysisStatus(recording, logic)
                    const canSelect = rowStatus.canLaunch && Boolean(logic.selectedPlanVersionId)
                    return (
                      <TableRow key={recording.key}>
                        <TableCell>
                          <SelectionButton
                            checked={selectedKeys.has(recording.key)}
                            disabled={!canSelect}
                            onClick={() => toggleRecording(recording.key)}
                            label="Sélectionner"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{recording.commercialNom || 'Inconnu'}</div>
                        </TableCell>
                        <TableCell>{formatRecordingDuration(recording)}</TableCell>
                        <TableCell>{formatDate(recording.lastModified)}</TableCell>
                        <TableCell>{formatSpeechState(recording)}</TableCell>
                        <TableCell>
                          <RecordingAnalysisState recording={recording} logic={logic} />
                        </TableCell>
                        <TableCell>{formatRecordingSize(recording)}</TableCell>
                        <TableCell>
                          {recording.latestSessionId ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => logic.openSession(recording.latestSessionId)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              <span className="mr-1">
                                {STATUS_LABELS[recording.latestSessionStatus] ||
                                  recording.latestSessionStatus}
                              </span>
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">Aucune</span>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[340px] text-right">
                          <RecordingActions recording={recording} logic={logic} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
              {!isRefreshing && visibleRecordings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Aucun candidat IA disponible pour cette recherche.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableFrame>

        <Pagination
          currentPage={logic.recordingsPage}
          totalPages={logic.recordingsTotalPages}
          startIndex={logic.recordingsStartIndex}
          endIndex={logic.recordingsEndIndex}
          totalItems={logic.recordingsTotal}
          itemLabel="candidats"
          onPrevious={logic.goToPreviousRecordingsPage}
          onNext={logic.goToNextRecordingsPage}
          hasPreviousPage={logic.hasPreviousRecordingsPage}
          hasNextPage={logic.hasNextRecordingsPage}
        />
      </CardContent>
    </Card>
  )
}

function SelectionButton({ checked, indeterminate = false, disabled = false, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={[
        'flex h-4.5 w-4.5 items-center justify-center rounded-md border transition-all duration-150',
        checked || indeterminate
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border/80 bg-background hover:border-primary/50',
        disabled ? 'cursor-not-allowed opacity-40 hover:border-border/80' : '',
      ].join(' ')}
    >
      {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      {!checked && indeterminate ? <Minus className="h-3 w-3" strokeWidth={3} /> : null}
    </button>
  )
}

function formatRecordingDuration(recording) {
  return formatDuration(numberOrZero(recording.totalDurationSec))
}

function formatSpeechState(recording) {
  if (recording.speechScore !== null && recording.speechScore !== undefined) {
    return `${recording.speechScore}%`
  }
  if (recording.speechScoreStatus === 'analyzing' || recording.speechScoreStatus === 'pending') {
    return <span className="text-sm text-muted-foreground">Calcul parole</span>
  }
  return '0%'
}

function formatRecordingSize(recording) {
  if (recording.size === null || recording.size === undefined) return '0 Ko'
  return formatSize(recording.size)
}

function RecordingAnalysisState({ recording, logic }) {
  const status = getRecordingAnalysisStatus(recording, logic)
  const exploitabilityLabel =
    EXPLOITABILITY_LABELS[recording.exploitabilityStatus] || recording.exploitabilityStatus

  if (status.kind === 'launching' || status.kind === 'queued' || status.kind === 'processing') {
    return (
      <div>
        <ToneBadge status={status.kind === 'queued' ? 'QUEUED' : 'PROCESSING'} className="gap-1.5">
          {status.kind === 'queued' ? (
            <Clock3 className="h-3 w-3" />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {status.label}
        </ToneBadge>
        <div className="mt-1 text-xs text-muted-foreground">{status.hint}</div>
      </div>
    )
  }

  if (status.kind === 'done') {
    return (
      <div>
        <ToneBadge status="ALREADY_ANALYZED" className="gap-1.5">
          <CheckCircle2 className="h-3 w-3" />
          Déjà analysé
        </ToneBadge>
        <div className="mt-1 text-xs text-muted-foreground">Fiche disponible</div>
      </div>
    )
  }

  return (
    <div>
      <ToneBadge status={recording.exploitabilityStatus}>{exploitabilityLabel}</ToneBadge>
      <div className="mt-1 text-xs text-muted-foreground">
        {['PRIORITY', 'GOOD'].includes(recording.exploitabilityStatus)
          ? 'Prêt à analyser'
          : 'À vérifier avant lancement'}
      </div>
    </div>
  )
}

function RecordingActions({ recording, logic }) {
  const status = getRecordingAnalysisStatus(recording, logic)
  const canLaunch = status.canLaunch && logic.selectedPlanVersionId

  if (recording.latestSessionId && !canLaunch) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => logic.openSession(recording.latestSessionId)}
        className="shrink-0"
      >
        <Eye className="mr-2 h-4 w-4" />
        Voir fiche
      </Button>
    )
  }

  return (
    <div className="flex flex-nowrap justify-end gap-2 whitespace-nowrap">
      <Button
        type="button"
        size="sm"
        onClick={() => logic.launchAnalysis(recording.key)}
        disabled={!canLaunch}
        className="shrink-0"
      >
        {status.kind === 'launching' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <PlayCircle className="mr-2 h-4 w-4" />
        )}
        {status.kind === 'launching' ? 'Lancement...' : 'Lancer'}
      </Button>
      {!recording.latestSessionId && status.canLaunch ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => logic.launchAnalysis(recording.key, { openAfterLaunch: true })}
          disabled={!logic.selectedPlanVersionId || status.kind === 'launching'}
          className="shrink-0"
        >
          <Eye className="mr-2 h-4 w-4" />
          Lancer et ouvrir
        </Button>
      ) : null}
      {recording.latestSessionId ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => logic.openSession(recording.latestSessionId)}
          className="shrink-0"
        >
          <Eye className="mr-2 h-4 w-4" />
          Voir fiche
        </Button>
      ) : null}
    </div>
  )
}
