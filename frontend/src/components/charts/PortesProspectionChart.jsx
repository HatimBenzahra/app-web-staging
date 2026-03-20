import React, { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

const chartConfig = {
  portes: {
    label: 'Portes prospectées',
    color: 'hsl(var(--chart-1))',
  },
}

/**
 * Composant graphique pour afficher le nombre de portes prospectées par jour
 * @param {Object} props
 * @param {Array} props.portes - Liste des portes avec derniereVisite
 * @param {string} props.title - Titre du graphique
 * @param {string} props.description - Description du graphique
 * @param {number} props.daysToShow - Nombre de jours à afficher (par défaut 7)
 */
export default function PortesProspectionChart({
  portes = [],
  title = 'Portes prospectées par jour',
  description = 'Derniers 7 jours',
  daysToShow = 7,
}) {
  // Préparer les données pour le graphique
  const chartData = useMemo(() => {
    if (!portes || portes.length === 0) {
      return []
    }

    // Créer un tableau des X derniers jours
    const days = []
    const today = new Date()

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      days.push({
        date: date.toISOString().split('T')[0], // Format YYYY-MM-DD
        label: date.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
        portes: 0,
      })
    }

    // Compter les portes prospectées par jour
    portes.forEach(porte => {
      // Ignorer les portes non visitées
      if (porte.statut === 'NON_VISITE' || !porte.derniereVisite) {
        return
      }

      const visitDate = new Date(porte.derniereVisite).toISOString().split('T')[0]
      const dayData = days.find(day => day.date === visitDate)

      if (dayData) {
        dayData.portes += 1
      }
    })

    return days
  }, [portes, daysToShow])

  // Calculer les statistiques
  const totalPortes = useMemo(() => {
    return chartData.reduce((sum, day) => sum + day.portes, 0)
  }, [chartData])

  const maxPortes = useMemo(() => {
    return Math.max(...chartData.map(day => day.portes), 0)
  }, [chartData])

  const averagePortes = useMemo(() => {
    if (chartData.length === 0) return 0
    return Math.round((totalPortes / chartData.length) * 10) / 10
  }, [totalPortes, chartData.length])

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
              <p className="text-xs mt-1">Commencez à prospecter pour voir les statistiques</p>
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
          <div className="text-2xl font-bold text-chart-1">{totalPortes}</div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              className="text-xs"
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              className="text-xs"
              domain={[0, Math.max(maxPortes + 1, 5)]}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      const date = new Date(payload[0].payload.date)
                      return date.toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })
                    }
                    return label
                  }}
                  formatter={value => [`${value} porte${value > 1 ? 's' : ''}`, 'Prospectées']}
                />
              }
            />
            <Bar
              dataKey="portes"
              fill="var(--color-chart-1)"
              radius={[4, 4, 0, 0]}
              className="fill-chart-1"
            />
          </BarChart>
        </ChartContainer>

        {/* Statistiques supplémentaires */}
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-4 pt-4 border-t">
          <div>
            <span className="font-medium">Moyenne: </span>
            <span className="text-foreground">{averagePortes} portes/jour</span>
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
