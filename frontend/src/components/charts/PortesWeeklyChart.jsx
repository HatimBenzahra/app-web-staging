import React, { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

const chartConfig = {
  portes: {
    label: 'Portes prospectées',
    color: 'hsl(var(--chart-2))',
  },
}

/**
 * Composant graphique pour afficher le nombre de portes prospectées par semaine
 * @param {Object} props
 * @param {Array} props.portes - Liste des portes avec derniereVisite
 * @param {string} props.title - Titre du graphique
 * @param {string} props.description - Description du graphique
 * @param {number} props.weeksToShow - Nombre de semaines à afficher (par défaut 4)
 */
export default function PortesWeeklyChart({
  portes = [],
  title = 'Portes prospectées par semaine',
  description = 'Dernières 4 semaines',
  weeksToShow = 4,
}) {
  // Fonction utilitaire pour obtenir le lundi d'une semaine
  const getMonday = date => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Ajuster au lundi
    return new Date(d.setDate(diff))
  }

  // Fonction pour formater la semaine
  const formatWeek = monday => {
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const mondayStr = monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    const sundayStr = sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

    return `${mondayStr} - ${sundayStr}`
  }

  // Préparer les données pour le graphique
  const chartData = useMemo(() => {
    if (!portes || portes.length === 0) {
      return []
    }

    // Créer un tableau des X dernières semaines
    const weeks = []
    const today = new Date()

    for (let i = weeksToShow - 1; i >= 0; i--) {
      const weekStart = getMonday(today)
      weekStart.setDate(weekStart.getDate() - i * 7)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)

      weeks.push({
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        label: formatWeek(weekStart),
        shortLabel: `S${weeksToShow - i}`,
        portes: 0,
      })
    }

    // Compter les portes prospectées par semaine
    portes.forEach(porte => {
      // Ignorer les portes non visitées
      if (porte.statut === 'NON_VISITE' || !porte.derniereVisite) {
        return
      }

      const visitDate = new Date(porte.derniereVisite).toISOString().split('T')[0]

      // Trouver dans quelle semaine cette visite tombe
      const weekData = weeks.find(week => visitDate >= week.weekStart && visitDate <= week.weekEnd)

      if (weekData) {
        weekData.portes += 1
      }
    })

    return weeks
  }, [portes, weeksToShow])

  // Calculer les statistiques
  const totalPortes = useMemo(() => {
    return chartData.reduce((sum, week) => sum + week.portes, 0)
  }, [chartData])

  const maxPortes = useMemo(() => {
    return Math.max(...chartData.map(week => week.portes), 0)
  }, [chartData])

  const averagePortes = useMemo(() => {
    if (chartData.length === 0) return 0
    return Math.round((totalPortes / chartData.length) * 10) / 10
  }, [totalPortes, chartData.length])

  // Calculer la tendance (comparaison des 2 dernières semaines)
  const trend = useMemo(() => {
    if (chartData.length < 2) return null

    const lastWeek = chartData[chartData.length - 1]?.portes || 0
    const previousWeek = chartData[chartData.length - 2]?.portes || 0

    if (previousWeek === 0) return null

    const percentage = ((lastWeek - previousWeek) / previousWeek) * 100
    return Math.round(percentage * 10) / 10
  }, [chartData])

  // Si pas de données, afficher un message
  if (chartData.length === 0 || totalPortes === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            <div className="text-center">
              <p className="text-sm">Aucune donnée de prospection</p>
              <p className="text-xs mt-1">Commencez à prospecter pour voir les tendances</p>
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
          <div className="text-2xl font-bold text-chart-2">{totalPortes}</div>
          {trend !== null && (
            <div
              className={`text-xs flex items-center gap-1 ${
                trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-600'
              }`}
            >
              <span>{trend > 0 ? '↗' : trend < 0 ? '↘' : '→'}</span>
              <span>{Math.abs(trend)}% vs semaine précédente</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <AreaChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} className="text-xs" />
            <YAxis
              tickLine={false}
              axisLine={false}
              className="text-xs"
              domain={[0, Math.max(maxPortes + 2, 10)]}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Semaine du ${payload[0].payload.label}`
                    }
                    return label
                  }}
                  formatter={value => [`${value} porte${value > 1 ? 's' : ''}`, 'Prospectées']}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="portes"
              stroke="var(--color-chart-2)"
              fill="var(--color-chart-2)"
              fillOpacity={0.2}
              strokeWidth={2}
              className="stroke-chart-2 fill-chart-2/20"
            />
          </AreaChart>
        </ChartContainer>

        {/* Statistiques supplémentaires */}
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-4 pt-4 border-t">
          <div>
            <span className="font-medium">Moyenne: </span>
            <span className="text-foreground">{averagePortes} portes/semaine</span>
          </div>
          <div>
            <span className="font-medium">Maximum: </span>
            <span className="text-foreground">{maxPortes} portes</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
