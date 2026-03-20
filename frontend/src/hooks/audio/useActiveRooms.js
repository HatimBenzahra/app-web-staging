import { useCallback } from 'react'
import { AudioMonitoringService } from '@/services/audio'
import { useAsyncState } from '@/hooks/utils/async/useAsyncState'
import { usePolling } from '@/hooks/utils/async/useInterval'

/**
 * Hook pour récupérer et surveiller les rooms actives et les commerciaux en ligne
 */
export function useActiveRooms(refreshInterval = 5000) {
  // Utiliser useAsyncState pour gérer l'état loading/error/data
  const asyncState = useAsyncState({
    namespace: 'ActiveRooms',
    retryEnabled: true,
    retryDelays: [1000, 2000, 4000],
    showToasts: true,
  })

  // Fonction pour récupérer les données
  const fetchData = useCallback(async () => {
    // Récupérer les rooms actives et les sessions en parallèle
    const [rooms, sessions] = await Promise.all([
      AudioMonitoringService.getActiveRooms(),
      AudioMonitoringService.getActiveSessions(),
    ])

    return {
      activeRooms: rooms || [],
      activeSessions: sessions || [],
    }
  }, [])

  // Utiliser usePolling pour le rafraîchissement automatique
  usePolling(() => asyncState.execute(fetchData), refreshInterval, {
    enabled: !!refreshInterval,
    immediate: true,
    namespace: 'ActiveRoomsPolling',
  })

  // Fonctions utilitaires qui utilisent les données de asyncState
  const isUserOnline = useCallback(
    (userId, userType = 'commercial') => {
      // Supporter à la fois commercial et manager
      const userKey = userType === 'manager' ? `manager-${userId}` : `commercial-${userId}`
      const activeRooms = asyncState.data?.activeRooms || []

      // Vérifier si l'utilisateur a une room active
      return activeRooms.some(room => room.participantNames.includes(userKey))
    },
    [asyncState.data]
  )

  const getOnlineUsers = useCallback(() => {
    const onlineUsers = []
    const activeRooms = asyncState.data?.activeRooms || []

    activeRooms.forEach(room => {
      room.participantNames.forEach(participantName => {
        if (participantName.startsWith('commercial-') || participantName.startsWith('manager-')) {
          const [userType, userIdStr] = participantName.split('-')
          const userId = parseInt(userIdStr)
          if (!isNaN(userId)) {
            onlineUsers.push({
              userId,
              userType,
              roomName: room.roomName,
              participantName,
              connectedAt: room.createdAt,
              numParticipants: room.numParticipants,
            })
          }
        }
      })
    })

    return onlineUsers
  }, [asyncState.data])

  const getActiveSessionsForUser = useCallback(
    (userId, userType) => {
      const activeSessions = asyncState.data?.activeSessions || []
      return activeSessions.filter(
        session =>
          session.userId === userId && session.userType === userType && session.status === 'ACTIVE'
      )
    },
    [asyncState.data]
  )

  return {
    // Données (avec fallback pour compatibilité)
    activeRooms: asyncState.data?.activeRooms || [],
    activeSessions: asyncState.data?.activeSessions || [],

    // État
    loading: asyncState.loading,
    error: asyncState.error,

    // Fonctions utilitaires (nouvelles)
    isUserOnline,
    getOnlineUsers,
    getActiveSessionsForUser,

    // Actions
    refetch: () => asyncState.execute(fetchData),
  }
}

export default useActiveRooms
