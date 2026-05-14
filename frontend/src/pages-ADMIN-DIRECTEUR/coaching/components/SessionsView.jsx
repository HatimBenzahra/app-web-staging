import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { REVIEW_LABELS, STATUS_LABELS } from '../coaching.constants'
import { formatDate, statusVariant } from '../coaching.utils'

export default function SessionsView({ logic }) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Analyses coaching</CardTitle>
        <CardDescription>
          Historique des sessions lancées. Ouvre une fiche pour lire le rapport détaillé et la
          revue.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Commercial</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Review</TableHead>
              <TableHead>Créée le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logic.sessions.map(session => (
              <TableRow
                key={session.id}
                className="cursor-pointer"
                onClick={() => logic.openSession(session.id)}
              >
                <TableCell className="font-medium">#{session.id}</TableCell>
                <TableCell>{session.commercialNom || 'Inconnu'}</TableCell>
                <TableCell>
                  <div className="text-sm">{session.salesPlanNom || 'Plan supprimé'}</div>
                  <div className="text-xs text-muted-foreground">
                    {session.salesPlanVersionLabel || 'Version sans label'}
                  </div>
                </TableCell>
                <TableCell>{session.overallScore ?? 'n/a'}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(session.status)}>
                    {STATUS_LABELS[session.status] || session.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {REVIEW_LABELS[session.reviewStatus] || session.reviewStatus}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(session.createdAt)}</TableCell>
              </TableRow>
            ))}
            {logic.sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Aucune session coaching pour le moment.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
