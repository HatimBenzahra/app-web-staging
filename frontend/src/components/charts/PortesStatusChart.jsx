import React, { useMemo } from 'react'
import { Pie, PieChart, Cell } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import {
  getStatusLabel,
  getStatusChartColor,
  StatutPorte
} from '@/constants/domain/porte-status'

// Configuration des couleurs et libellés pour chaque statut
// Utilise les fonctions centralisées du fichier constants
const statusConfig = {
  [StatutPorte.CONTRAT_SIGNE]: {
    label: getStatusLabel(StatutPorte.CONTRAT_SIGNE),
    color: getStatusChartColor(StatutPorte.CONTRAT_SIGNE),
    fill: getStatusChartColor(StatutPorte.CONTRAT_SIGNE),
  },
  [StatutPorte.RENDEZ_VOUS_PRIS]: {
    label: getStatusLabel(StatutPorte.RENDEZ_VOUS_PRIS),
    color: getStatusChartColor(StatutPorte.RENDEZ_VOUS_PRIS),
    fill: getStatusChartColor(StatutPorte.RENDEZ_VOUS_PRIS),
  },
  [StatutPorte.ABSENT]: {
    label: getStatusLabel(StatutPorte.ABSENT),
    color: getStatusChartColor(StatutPorte.ABSENT),
    fill: getStatusChartColor(StatutPorte.ABSENT),
  },
  [StatutPorte.ARGUMENTE]: {
    label: getStatusLabel(StatutPorte.ARGUMENTE),
    color: getStatusChartColor(StatutPorte.ARGUMENTE),
    fill: getStatusChartColor(StatutPorte.ARGUMENTE),
  },
  [StatutPorte.REFUS]: {
    label: getStatusLabel(StatutPorte.REFUS),
    color: getStatusChartColor(StatutPorte.REFUS),
    fill: getStatusChartColor(StatutPorte.REFUS),
  },
  [StatutPorte.NECESSITE_REPASSAGE]: {
    label: getStatusLabel(StatutPorte.NECESSITE_REPASSAGE),
    color: getStatusChartColor(StatutPorte.NECESSITE_REPASSAGE),
    fill: getStatusChartColor(StatutPorte.NECESSITE_REPASSAGE),
  },
  [StatutPorte.NON_VISITE]: {
    label: getStatusLabel(StatutPorte.NON_VISITE),
    color: getStatusChartColor(StatutPorte.NON_VISITE),
    fill: getStatusChartColor(StatutPorte.NON_VISITE),
  },
}

const chartConfig = {
  contrats: {
    label: getStatusLabel(StatutPorte.CONTRAT_SIGNE),
    color: getStatusChartColor(StatutPorte.CONTRAT_SIGNE),
  },
  rdv: {
    label: getStatusLabel(StatutPorte.RENDEZ_VOUS_PRIS),
    color: getStatusChartColor(StatutPorte.RENDEZ_VOUS_PRIS),
  },
  absent: {
    label: getStatusLabel(StatutPorte.ABSENT),
    color: getStatusChartColor(StatutPorte.ABSENT),
  },
  argumente: {
    label: getStatusLabel(StatutPorte.ARGUMENTE),
    color: getStatusChartColor(StatutPorte.ARGUMENTE),
  },
  refus: {
    label: getStatusLabel(StatutPorte.REFUS),
    color: getStatusChartColor(StatutPorte.REFUS),
  },
  repassage: {
    label: getStatusLabel(StatutPorte.NECESSITE_REPASSAGE),
    color: getStatusChartColor(StatutPorte.NECESSITE_REPASSAGE),
  },
  nonVisite: {
    label: getStatusLabel(StatutPorte.NON_VISITE),
    color: getStatusChartColor(StatutPorte.NON_VISITE),
  },
}

/**
 * Composant graphique circulaire pour afficher la répartition des statuts des portes
 * @param {Object} props
 * @param {Array} props.portes - Liste des portes avec leur statut
 * @param {string} props.title - Titre du graphique
 * @param {string} props.description - Description du graphique
 * @param {boolean} props.showNonVisited - Afficher ou non les portes non visitées (défaut: true)
 */
export default function PortesStatusChart({
  portes = [],
  title = 'Répartition des statuts',
  description = 'État actuel de la prospection',
  showNonVisited = true,
}) {
  // Préparer les données pour le graphique circulaire
  const chartData = useMemo(() => {
    if (!portes || portes.length === 0) {
      return []
    }

    // Compter chaque statut
    const statusCounts = {
      CONTRAT_SIGNE: 0,
      RENDEZ_VOUS_PRIS: 0,
      ABSENT: 0,
      ARGUMENTE: 0,
      REFUS: 0,
      NECESSITE_REPASSAGE: 0,
      NON_VISITE: 0,
    }

    portes.forEach(porte => {
      if (porte.statut in statusCounts) {
        // Pour les contrats signés, on ajoute le nombre de contrats
        if (porte.statut === 'CONTRAT_SIGNE') {
          statusCounts[porte.statut] += (porte.nbContrats || 1)
        } else {
          statusCounts[porte.statut]++
        }
      }
    })

    // Convertir en format attendu par Recharts
    const data = Object.entries(statusCounts)
      .filter(([status, count]) => {
        // Filtrer les portes non visitées si demandé
        if (!showNonVisited && status === 'NON_VISITE') {
          return false
        }
        return count > 0 // Ne garder que les statuts avec au moins 1 porte
      })
      .map(([status, count]) => ({
        name: statusConfig[status].label,
        value: count,
        status: status,
        fill: statusConfig[status].fill,
        percentage: portes.length > 0 ? Math.round((count / portes.length) * 100) : 0,
      }))

    return data
  }, [portes, showNonVisited])

  // Calculer les statistiques
  const totalPortes = useMemo(() => {
    return portes.length
  }, [portes])

  const portesProspectees = useMemo(() => {
    return portes.filter(p => p.statut !== 'NON_VISITE').length
  }, [portes])

  const tauxProspection = useMemo(() => {
    if (totalPortes === 0) return 0
    return Math.round((portesProspectees / totalPortes) * 100)
  }, [portesProspectees, totalPortes])

  const tauxReussite = useMemo(() => {
    // Somme des nbContrats pour toutes les portes avec statut CONTRAT_SIGNE
    const contrats = portes
      .filter(p => p.statut === 'CONTRAT_SIGNE')
      .reduce((sum, p) => sum + (p.nbContrats || 1), 0)
    const rdv = portes.filter(p => p.statut === 'RENDEZ_VOUS_PRIS').length
    const totalPositif = contrats + rdv

    if (portesProspectees === 0) return 0
    return Math.round((totalPositif / portesProspectees) * 100)
  }, [portes, portesProspectees])

  // Si pas de données, afficher un message
  if (chartData.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            <div className="text-center">
              <p className="text-sm">Aucune donnée disponible</p>
              <p className="text-xs mt-1">Commencez à prospecter pour voir la répartition</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{totalPortes}</div>
          <div className="text-xs text-muted-foreground">
            {portesProspectees} prospectées ({tauxProspection}%)
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name, props) => [
                    `${value} (${props.payload.percentage}%)`,
                    name,
                  ]}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={60}
              strokeWidth={2}
              stroke="hsl(var(--background))"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent />} verticalAlign="bottom" height={36} />
          </PieChart>
        </ChartContainer>

        {/* Statistiques supplémentaires */}
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-4 pt-4 border-t">
          <div>
            <span className="font-medium">Taux prospection: </span>
            <span className="text-foreground">{tauxProspection}%</span>
          </div>
          <div>
            <span className="font-medium">Taux réussite: </span>
            <span className="text-foreground">{tauxReussite}%</span>
          </div>
        </div>

        {/* Légende détaillée */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: item.fill }}
                />
                <span className="text-muted-foreground">{item.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium">{item.value}</span>
                <span className="text-muted-foreground">({item.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
