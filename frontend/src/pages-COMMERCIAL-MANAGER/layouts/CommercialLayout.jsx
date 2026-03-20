import React from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { BarChart3, Building2, History, Users } from 'lucide-react'
import { useRole } from '@/contexts/userole'
import { useWorkspaceProfile, useCurrentUserAssignment } from '@/hooks/metier/use-api'
import { useCommercialTheme } from '@/hooks/ui/use-commercial-theme'
import { useAutoAudio } from '@/hooks/audio/useAutoAudio'
import CommercialHeader from '@/components/CommercialHeader'
import CommercialBottomBar from '@/components/CommercialBottomBar'

/**
 * Layout principal pour l'espace commercial
 * Gère le header, la bottombar et la navigation de manière centralisée
 */
export default function CommercialLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUserId, isManager } = useRole()
  const { base, components } = useCommercialTheme()

  // Ref pour le scroll container (utilisée par PortesGestion)
  const scrollContainerRef = React.useRef(null)

  const userId = React.useMemo(() => {
    if (!currentUserId) return null
    const parsed = parseInt(currentUserId, 10)
    return isNaN(parsed) ? null : parsed
  }, [currentUserId])
  const workspaceRole = isManager ? 'manager' : 'commercial'

  // Détecter si on est sur la page équipe pour charger les données complètes avec les commerciaux
  const isTeamPage = location.pathname === '/equipe'
  const includeTeam = isManager && isTeamPage

  // Récupérer le profil (commercial ou manager) pour alimenter l'espace
  const {
    data: workspaceProfile,
    loading: profileLoading,
    error: profileError,
    refetch,
  } = useWorkspaceProfile(userId, workspaceRole, includeTeam)

  const { data: currentZoneAssignment } = useCurrentUserAssignment(
    userId,
    isManager ? 'MANAGER' : 'COMMERCIAL'
  )

  // Activer l'audio monitoring automatique pour commerciaux ET managers
  const {
    isConnected: audioConnected,
    isConnecting: audioConnecting,
    error: audioError,
    roomName,
  } = useAutoAudio(userId, workspaceRole, true)

  // Statistiques agrégées pour le header et les badges
  // CORRECTION: Utiliser UNIQUEMENT les stats personnelles du manager
  const workspaceStats = React.useMemo(() => {
    // Déterminer quelles stats utiliser selon le contexte
    // - Si c'est un manager avec personalStatistics disponible, utiliser celles-ci
    // - Sinon, utiliser statistics (pour les commerciaux ou fallback)
    const statsToUse = workspaceProfile?.personalStatistics || workspaceProfile?.statistics || []

    if (statsToUse.length === 0) {
      return {
        contratsSignes: 0,
        immeublesVisites: 0,
        rendezVousPris: 0,
        refus: 0,
      }
    }

    return statsToUse.reduce(
      (acc, stat) => ({
        contratsSignes: acc.contratsSignes + (stat.contratsSignes || 0),
        immeublesVisites: acc.immeublesVisites + (stat.immeublesVisites || 0),
        rendezVousPris: acc.rendezVousPris + (stat.rendezVousPris || 0),
        refus: acc.refus + (stat.refus || 0),
      }),
      {
        contratsSignes: 0,
        immeublesVisites: 0,
        rendezVousPris: 0,
        refus: 0,
      }
    )
  }, [workspaceProfile?.personalStatistics, workspaceProfile?.statistics])

  // Configuration des onglets de navigation
  const navigationItems = React.useMemo(() => {
    const personalImmeublesCount =
      isManager && workspaceProfile?.immeubles
        ? workspaceProfile.immeubles.filter(imm => imm.managerId === userId).length
        : workspaceProfile?.immeubles?.length || 0

    const items = [
      {
        id: 'stats',
        label: 'Tableau de bord',
        icon: BarChart3,
        badge: workspaceStats.contratsSignes,
        path: '/',
      },
      {
        id: 'immeubles',
        label: 'Immeubles',
        icon: Building2,
        badge: personalImmeublesCount,
        path: '/immeubles',
      },
      {
        id: 'historique',
        label: 'Historique',
        icon: History,
        badge: 0,
        path: '/historique',
      },
    ]

    if (isManager) {
      items.push({
        id: 'team',
        label: 'Équipe',
        icon: Users,
        badge: workspaceProfile?.commercials?.length || 0,
        path: '/equipe',
      })
    }

    return items
  }, [
    isManager,
    workspaceProfile?.commercials?.length,
    workspaceProfile?.immeubles,
    workspaceStats.contratsSignes,
    userId,
  ])

  // Déterminer l'onglet actif basé sur le chemin
  const getActiveTab = () => {
    const path = location.pathname

    if (path.startsWith('/portes/')) {
      return 'immeubles'
    }
    if (path === '/immeubles') return 'immeubles'
    if (path === '/historique') return 'historique'
    if (path === '/equipe') return 'team'
    return 'stats'
  }

  // Déterminer le titre de la page
  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/') return 'Tableau de bord'
    if (path === '/immeubles') return 'Mes Immeubles'
    if (path === '/historique') return 'Historique'
    if (path.startsWith('/portes/')) return 'Gestion des Portes'
    if (path === '/equipe') return 'Mon Équipe'
    return null
  }

  // Gestion du changement d'onglet
  const handleTabChange = tabId => {
    const navItem = navigationItems.find(item => item.id === tabId)
    if (navItem) {
      navigate(navItem.path)
    }
  }

  if (profileLoading) {
    return (
      <div className={`flex flex-col h-screen w-screen ${base.bg.card} overflow-hidden`}>
        <CommercialHeader
          commercial={null}
          currentZone={currentZoneAssignment?.zone}
          showGreeting={true}
          stats={workspaceStats}
          pageTitle={getPageTitle()}
        />
        <div className={components.loading.container}>
          <div className="text-center">
            <div className={`${components.loading.spinner} mx-auto mb-4`}></div>
            <p className={components.loading.text}>Chargement...</p>
          </div>
        </div>
        <CommercialBottomBar
          navigationItems={navigationItems}
          activeTab={getActiveTab()}
          onTabChange={handleTabChange}
        />
      </div>
    )
  }

  if (profileError || !workspaceProfile) {
    return (
      <div className={`flex flex-col h-screen w-screen ${base.bg.card} overflow-hidden`}>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {profileError || "Impossible de charger l'espace utilisateur."}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-screen w-screen ${base.bg.card} overflow-hidden`}>
      <CommercialHeader
        commercial={workspaceProfile}
        currentZone={currentZoneAssignment?.zone}
        showGreeting={true}
        stats={workspaceStats}
        pageTitle={getPageTitle()}
      />

      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto overflow-x-hidden ${base.bg.page} px-4 sm:px-6 py-2 sm:py-3 ${
          location.pathname.startsWith('/portes/')
            ? 'portes-scroll-container'
            : 'commercial-scroll-container pb-20'
        }`}
      >
        <Outlet
          context={{
            commercial: workspaceProfile,
            myStats: workspaceStats,
            commercialLoading: profileLoading,
            refetch,
            audioStatus: { audioConnected, audioConnecting, audioError, roomName },
            scrollContainerRef,
            workspaceRole,
            isManager,
          }}
        />
      </div>

      {/* Cacher la bottombar sur la page PortesGestion */}
      {!location.pathname.startsWith('/portes/') && (
        <CommercialBottomBar
          navigationItems={navigationItems}
          activeTab={getActiveTab()}
          onTabChange={handleTabChange}
        />
      )}
    </div>
  )
}
