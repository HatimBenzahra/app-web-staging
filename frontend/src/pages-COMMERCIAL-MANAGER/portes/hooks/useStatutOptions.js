import { useCommercialTheme } from '@/hooks/ui/use-commercial-theme'
import { getStatusOptions } from '@/constants/domain/porte-status'

/**
 * Hook pour obtenir les options de statut avec les couleurs du thème
 * Utilise maintenant le système centralisé de gestion des statuts
 */
export function useStatutOptions() {
  const { colors } = useCommercialTheme()
  return getStatusOptions(colors)
}
