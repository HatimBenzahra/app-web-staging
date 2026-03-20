import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * StatsCard - Carte de statistique avec support des variants et tendances
 *
 * @param {string} title - Titre de la carte
 * @param {string|number} value - Valeur à afficher
 * @param {string} description - Description optionnelle
 * @param {React.ReactNode} icon - Icône optionnelle
 * @param {string} trend - Tendance: 'up' | 'down' | null
 * @param {string} trendValue - Valeur de tendance (ex: "+12%")
 * @param {string} variant - Style de la carte: 'default' | 'success' | 'destructive' | 'primary' | 'muted' | 'warning'
 * @param {string} className - Classes CSS additionnelles
 */
export function StatsCard({
  title,
  value,
  description,
  icon,
  trend,
  trendValue,
  variant = 'default',
  className,
}) {
  const trendColor =
    trend === 'up'
      ? 'text-chart-2'
      : trend === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground'
  const trendIcon = trend === 'up' ? '↗️' : trend === 'down' ? '↘️' : '➡️'

  // Styles des variants pour les cartes de statistiques simples (sans header complexe)
  const variantStyles = {
    default: 'border-border',
    muted: 'bg-muted/50 border-muted',
    success: 'bg-chart-2/10 border-chart-2/20',
    destructive: 'bg-destructive/10 border-destructive/20',
    primary: 'bg-primary/10 border-primary/20',
    warning: 'bg-chart-5/10 border-chart-5/20',
  }

  const valueStyles = {
    default: 'text-foreground',
    muted: 'text-foreground',
    success: 'text-chart-2',
    destructive: 'text-destructive',
    primary: 'text-primary',
    warning: 'text-chart-5',
  }

  return (
    <Card className={cn(variantStyles[variant], 'transition-all hover:shadow-md', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-2xl opacity-70">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', valueStyles[variant])}>{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {trend && trendValue && (
          <div className={`flex items-center mt-2 text-xs ${trendColor}`}>
            <span className="mr-1">{trendIcon}</span>
            <span>{trendValue}</span>
            <span className="ml-1">from last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
