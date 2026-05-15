import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { PlayCircle } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { EXPLOITABILITY_LABELS, QUEUE_LABELS, STATUS_LABELS } from '../coaching.constants'
import { exploitabilityVariant, formatDate, formatSize } from '../coaching.utils'

export default function RecordingsView({ logic }) {
  return (
    <Card className="border-border/70">
      <CardHeader className="gap-4">
        <div className="space-y-1">
          <CardTitle>Candidats IA à analyser</CardTitle>
          <CardDescription>
            Liste priorisée pour choisir les appels exploitables et lancer une analyse coaching.
          </CardDescription>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr_0.8fr_0.8fr]">
          <div>
            <Label htmlFor="recordings-search">Recherche</Label>
            <Input
              id="recordings-search"
              value={logic.recordingsSearch}
              onChange={event => logic.setRecordingsSearch(event.target.value)}
              placeholder="Commercial, room, adresse, clé S3..."
              className="mt-2"
            />
          </div>
          <div>
            <Label>Commercial</Label>
            <Select
              value={logic.recordingsCommercialId}
              onValueChange={logic.setRecordingsCommercialId}
            >
              <SelectTrigger className="mt-2">
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
              <SelectTrigger className="mt-2">
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
              <SelectTrigger className="mt-2">
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
        </div>
        <div className="text-sm text-muted-foreground">
          {logic.recordingsTotal} candidat(s) trouvé(s)
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Commercial</TableHead>
                <TableHead>Enregistrement</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Parole</TableHead>
                <TableHead>Exploitabilité</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Dernière analyse</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logic.recordings.map(recording => (
                <TableRow key={recording.key}>
                  <TableCell>
                    <div className="font-medium">{recording.commercialNom || 'Inconnu'}</div>
                    <div className="text-xs text-muted-foreground">{recording.roomName}</div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-104 truncate text-sm">{recording.key}</div>
                  </TableCell>
                  <TableCell>{formatDate(recording.lastModified)}</TableCell>
                  <TableCell>
                    {recording.speechScore !== null && recording.speechScore !== undefined
                      ? `${recording.speechScore}%`
                      : recording.speechScoreStatus || 'n/a'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={exploitabilityVariant(recording.exploitabilityStatus)}>
                      {EXPLOITABILITY_LABELS[recording.exploitabilityStatus] ||
                        recording.exploitabilityStatus}
                    </Badge>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {recording.analysisJobStatus
                        ? QUEUE_LABELS[recording.analysisJobStatus] || recording.analysisJobStatus
                        : recording.latestSessionStatus === 'COMPLETED'
                          ? 'Déjà analysé'
                          : ['PRIORITY', 'GOOD'].includes(recording.exploitabilityStatus)
                            ? 'Éligible auto'
                            : 'Analyse manuelle'}
                    </div>
                  </TableCell>
                  <TableCell>{formatSize(recording.size)}</TableCell>
                  <TableCell>
                    {recording.latestSessionId ? (
                      <button
                        type="button"
                        className="text-left text-sm text-primary hover:underline"
                        onClick={() => logic.openSession(recording.latestSessionId)}
                      >
                        {STATUS_LABELS[recording.latestSessionStatus] ||
                          recording.latestSessionStatus}
                      </button>
                    ) : (
                      <span className="text-sm text-muted-foreground">Aucune</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => logic.launchAnalysis(recording.key)}
                      disabled={logic.submitting || !logic.selectedPlanVersionId}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Lancer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {logic.recordings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Aucun candidat IA disponible pour cette recherche.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

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
