import { cn } from '@/lib/utils'
import { Inbox } from 'lucide-react'

export default function EmptyState({ icon = Inbox, title, description, action, className }) {
  const IconComponent = icon
  return (
    <div
      className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/60 mb-5">
        <IconComponent className="h-7 w-7 text-muted-foreground/60" />
      </div>
      {title && <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>}
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
