import React, { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { TrendingUp } from 'lucide-react'

const chartConfig = {
  contratsSignes: {
    label: 'Contrats signés',
    color: 'hsl(var(--chart-1))', // Orange visible
  },
  rendezVousPris: {
    label: 'Rendez-vous pris',
    color: 'hsl(var(--chart-2))', // Vert visible
  },
}

/**
 * Composant graphique pour afficher l'évolution des contrats signés dans le temps
 * @param {Object} props
 * @param {Array} props.statistics - Liste des statistiques avec createdAt
 * @param {string} props.title - Titre du graphique
 * @param {string} props.description - Description du graphique
 * @param {number} props.daysToShow - Nombre de jours à afficher (par défaut 30)
 */
export default function ContratsEvolutionChart({
  statistics = [],
  title = 'Évolution des contrats signés',
  description = '30 derniers jours',
  daysToShow = 30,
}) {
  const chartData = useMemo(() => {
    if (!statistics?.length) return []

    // Créer les 30 derniers jours
    const days = []
    const today = new Date()

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)

      // Filtrer les statistiques pour ce jour
      const dayStats = statistics.filter(stat => {
        const statDate = new Date(stat.createdAt || stat.updatedAt)
        return statDate >= date && statDate < nextDay
      })

      // Calculer les totaux pour ce jour
      const contratsSignes = dayStats.reduce((sum, stat) => sum + (stat.contratsSignes || 0), 0)
      const rendezVousPris = dayStats.reduce((sum, stat) => sum + (stat.rendezVousPris || 0), 0)

      days.push({
        date: date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
        }),
        fullDate: date.toISOString().split('T')[0],
        contratsSignes,
        rendezVousPris,
      })
    }

    return days
  }, [statistics, daysToShow])

  // Calculer les totaux pour affichage dans le titre
  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, day) => ({
        contratsSignes: acc.contratsSignes + day.contratsSignes,
        rendezVousPris: acc.rendezVousPris + day.rendezVousPris,
      }),
      { contratsSignes: 0, rendezVousPris: 0 }
    )
  }, [chartData])

  return (
    <Card>
      <CardHeader className="flex items-start gap-2 border-b sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex gap-4">
          <div className="grid gap-1 text-center">
            <div className="text-2xl font-bold text-green-600">{totals.contratsSignes}</div>
            <div className="text-xs text-muted-foreground">Contrats signés</div>
          </div>
          <div className="grid gap-1 text-center">
            <div className="text-2xl font-bold text-blue-600">{totals.rendezVousPris}</div>
            <div className="text-xs text-muted-foreground">RDV pris</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-4 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 10 }}>
            <defs>
              <linearGradient id="fillContratsSignes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillRendezVousPris" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={4} width={40} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value, payload) => {
                    if (payload && payload[0]) {
                      const fullDate = payload[0].payload.fullDate
                      return new Date(fullDate).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })
                    }
                    return value
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="rendezVousPris"
              type="natural"
              fill="url(#fillRendezVousPris)"
              stroke="var(--chart-2)"
              stackId="a"
            />
            <Area
              dataKey="contratsSignes"
              type="natural"
              fill="url(#fillContratsSignes)"
              stroke="var(--chart-1)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
