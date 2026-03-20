import { useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { getStatusMeta } from '@/constants/domain/user-status'

export function useStatusBadge() {
  const renderStatusBadge = useCallback(status => {
    const meta = getStatusMeta(status)
    return <Badge className={`${meta.badgeClass} border`}>{meta.label}</Badge>
  }, [])

  return { renderStatusBadge, getStatusMeta }
}
