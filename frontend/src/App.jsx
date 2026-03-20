import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { RoleProvider } from '@/contexts/RoleContext'
import { useRole } from '@/contexts/userole'
import { DetailsSectionsProvider } from '@/contexts/DetailsSectionsProvider'
import { AppLoadingProvider } from '@/contexts/AppLoadingProvider'
import ErrorBoundary from '@/components/ErrorBoundary'
import SectionErrorBoundary from '@/components/SectionErrorBoundary'
import SessionManager from '@/components/SessionManager'
import { OfflineSyncProvider } from '@/components/OfflineSyncProvider'

// Lazy load auth pages
const Login = lazy(() => import('@/pages-AUTH/Login'))
const Unauthorized = lazy(() => import('@/pages-AUTH/Unauthorized'))

// Lazy load admin/directeur pages
const Dashboard = lazy(() => import('@/pages-ADMIN-DIRECTEUR/dashboard/Dashboard'))
const Commerciaux = lazy(() => import('@/pages-ADMIN-DIRECTEUR/commercial/Commerciaux'))
const Managers = lazy(() => import('@/pages-ADMIN-DIRECTEUR/managers/Managers'))
const Directeurs = lazy(() => import('@/pages-ADMIN-DIRECTEUR/directeurs/Directeurs'))
const Immeubles = lazy(() => import('@/pages-ADMIN-DIRECTEUR/immeubles/Immeubles'))
const Zones = lazy(() => import('@/pages-ADMIN-DIRECTEUR/zones/Zones'))
const HistoriqueZones = lazy(() => import('@/pages-ADMIN-DIRECTEUR/zones/HistoriqueZones'))
const AssignationsEnCours = lazy(() => import('@/pages-ADMIN-DIRECTEUR/zones/AssignationsEnCours'))
const CommercialDetails = lazy(() => import('@/pages-ADMIN-DIRECTEUR/commercial/CommercialDetails'))
const ManagerDetails = lazy(() => import('@/pages-ADMIN-DIRECTEUR/managers/ManagerDetails'))
const DirecteurDetails = lazy(() => import('@/pages-ADMIN-DIRECTEUR/directeurs/DirecteurDetails'))
const ImmeubleDetails = lazy(() => import('@/pages-ADMIN-DIRECTEUR/immeubles/ImmeubleDetails'))
const PorteDetails = lazy(() => import('@/pages-ADMIN-DIRECTEUR/immeubles/PorteDetails'))
const ZoneDetails = lazy(() => import('@/pages-ADMIN-DIRECTEUR/zones/ZoneDetails'))
const GPSTracking = lazy(() => import('@/pages-ADMIN-DIRECTEUR/gps-tracking/GPSTracking'))
const EcouteLive = lazy(() => import('@/pages-ADMIN-DIRECTEUR/ecoutes/EcouteLive'))
const Enregistrement = lazy(() => import('@/pages-ADMIN-DIRECTEUR/ecoutes/Enregistrement'))
const Statistiques = lazy(() => import('@/pages-ADMIN-DIRECTEUR/statistiques/Statistiques'))
const Gestion = lazy(() => import('@/pages-ADMIN-DIRECTEUR/gestion/Gestion'))
const Gamification = lazy(() => import('@/pages-ADMIN-DIRECTEUR/gamification/Gamification'))
const KioskOverview = lazy(() => import('@/pages-ADMIN-DIRECTEUR/kiosk/KioskOverview'))
const KioskDevicesPage = lazy(() => import('@/pages-ADMIN-DIRECTEUR/kiosk/KioskDevicesPage'))
const KioskReleasesPage = lazy(() => import('@/pages-ADMIN-DIRECTEUR/kiosk/KioskReleasesPage'))
const KioskDeploymentsPage = lazy(() => import('@/pages-ADMIN-DIRECTEUR/kiosk/KioskDeploymentsPage'))
const KioskLogsPage = lazy(() => import('@/pages-ADMIN-DIRECTEUR/kiosk/KioskLogsPage'))
const KioskLocationPage = lazy(() => import('@/pages-ADMIN-DIRECTEUR/kiosk/KioskLocationPage'))

// Lazy load commercial pages
const CommercialLayoutComponent = lazy(
  () => import('@/pages-COMMERCIAL-MANAGER/layouts/CommercialLayout')
)
const CommercialDashboard = lazy(
  () => import('@/pages-COMMERCIAL-MANAGER/dashboard/CommercialDashboard')
)
const ImmeublesList = lazy(() => import('@/pages-COMMERCIAL-MANAGER/immeubles/ImmeublesList'))
const Historique = lazy(() => import('@/pages-COMMERCIAL-MANAGER/historique/Historique'))
const PortesGestion = lazy(() => import('@/pages-COMMERCIAL-MANAGER/portes/PortesGestion'))
const PortesLecture = lazy(() => import('@/pages-COMMERCIAL-MANAGER/portes/PortesLecture'))
const TeamManagement = lazy(() => import('@/pages-COMMERCIAL-MANAGER/team/TeamManagement'))

// Import Admin/Directeur/Manager Layout & Pages
import { AppSidebar } from '@/components/sidebar'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import ThemeToggle from '@/components/ThemeSwitchDarklight'
import { ChevronRight, Search } from 'lucide-react'
import GlobalSearchDialog from '@/components/GlobalSearchDialog'

import React from 'react'

// Layout pour Admin/Directeur/Manager (avec sidebar)
function AdminLayout() {
  const location = useLocation()

  const breadcrumbMap = {
    '': { label: 'Tableau de bord', href: '/' },
    dashboard: { label: 'Tableau de bord', href: '/' },
    commerciaux: { label: 'Commerciaux', href: '/commerciaux' },
    managers: { label: 'Managers', href: '/managers' },
    directeurs: { label: 'Directeurs', href: '/directeurs' },
    immeubles: { label: 'Immeubles', href: '/immeubles' },
    portes: { label: 'Porte', href: '' },
    zones: { label: 'Zones', href: '/zones' },
    gestion: { label: 'Gestion', href: '/gestion' },
    'gps-tracking': { label: 'Suivi GPS', href: '/gps-tracking' },
    ecoutes: { label: 'Écoutes', href: '/ecoutes/live' },
    statistiques: { label: 'Statistiques', href: '/statistiques' },
    gamification: { label: 'Gamification', href: '/gamification' },
    kiosk: { label: 'Kiosk', href: '/kiosk' },
    tablettes: { label: 'Tablettes', href: '/kiosk/tablettes' },
    releases: { label: 'Releases', href: '/kiosk/releases' },
    deploiements: { label: 'Déploiements', href: '/kiosk/deploiements' },
    logs: { label: 'Logs', href: '/kiosk/logs' },
    localisation: { label: 'Localisation', href: '/kiosk/localisation' },
    assignations: { label: 'Assignations en cours', href: '/zones/assignations' },
    historique: { label: 'Historique', href: '/zones/historique' },
  }

  const buildBreadcrumbs = () => {
    const segments = location.pathname.replace(/^\//, '').split('/').filter(Boolean)

    // Si page d’accueil
    if (segments.length === 0) return [{ label: 'Tableau de bord', href: '/', isCurrent: true }]

    const breadcrumbs = []
    let accumulatedPath = ''

    segments.forEach((segment, index) => {
      accumulatedPath += `/${segment}`

      const isLast = index === segments.length - 1
      const mapping = breadcrumbMap[segment]

      const label = mapping?.label || (isNaN(Number(segment)) ? segment : 'Détails')
      const href = mapping?.href || accumulatedPath

      breadcrumbs.push({
        label,
        href,
        isCurrent: isLast,
      })
    })

    return [{ label: 'Tableau de bord', href: '/', isCurrent: false }, ...breadcrumbs]
  }

  const breadcrumbs = buildBreadcrumbs()

  return (
    <ErrorBoundary>
      <DetailsSectionsProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="overflow-x-hidden">
            <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b">
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <nav className="flex items-center gap-1 text-sm text-muted-foreground">
                  {breadcrumbs.map((crumb, index) => (
                    <React.Fragment
                      key={`${crumb.href}-${crumb.label}-${crumb.isCurrent ? 'current' : 'link'}`}
                    >
                      {index > 0 && (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                      {crumb.isCurrent ? (
                        <span className="font-semibold text-foreground">{crumb.label}</span>
                      ) : (
                        <Link
                          to={crumb.href}
                          className="hover:text-foreground transition-colors rounded-md px-1.5 py-0.5 hover:bg-muted"
                        >
                          {crumb.label}
                        </Link>
                      )}
                    </React.Fragment>
                  ))}
                </nav>
              </div>
              <div className="flex items-center gap-3 px-4">
                <button
                  type="button"
                  onClick={() => document.dispatchEvent(new CustomEvent('open-global-search'))}
                  className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-sm text-muted-foreground/70 hover:bg-muted/40 hover:text-muted-foreground hover:border-border transition-all duration-150 shadow-sm md:w-64 md:gap-3 md:px-3.5"
                >
                  <Search className="h-4 w-4 shrink-0" />
                  <span className="hidden md:block flex-1 text-left text-[13px]">
                    Rechercher...
                  </span>
                </button>
                <ThemeToggle />
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-6 pt-6 overflow-x-hidden mx-auto w-11/12 max-w-[1400px] animate-fade-in-content">
              <Suspense fallback={null}>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <SectionErrorBoundary>
                        <Dashboard />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/commerciaux"
                    element={
                      <SectionErrorBoundary>
                        <Commerciaux />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/commerciaux/:id"
                    element={
                      <SectionErrorBoundary>
                        <CommercialDetails />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/managers"
                    element={
                      <SectionErrorBoundary>
                        <Managers />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/managers/:id"
                    element={
                      <SectionErrorBoundary>
                        <ManagerDetails />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/directeurs"
                    element={
                      <SectionErrorBoundary>
                        <Directeurs />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/directeurs/:id"
                    element={
                      <SectionErrorBoundary>
                        <DirecteurDetails />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/immeubles"
                    element={
                      <SectionErrorBoundary>
                        <Immeubles />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/immeubles/:id"
                    element={
                      <SectionErrorBoundary>
                        <ImmeubleDetails />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/immeubles/:id/portes/:porteId"
                    element={
                      <SectionErrorBoundary>
                        <PorteDetails />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/zones"
                    element={
                      <SectionErrorBoundary>
                        <Zones />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/zones/historique"
                    element={
                      <SectionErrorBoundary>
                        <HistoriqueZones />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/zones/assignations"
                    element={
                      <SectionErrorBoundary>
                        <AssignationsEnCours />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/zones/:id"
                    element={
                      <SectionErrorBoundary>
                        <ZoneDetails />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/gestion"
                    element={
                      <SectionErrorBoundary>
                        <Gestion />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/gps-tracking"
                    element={
                      <SectionErrorBoundary>
                        <GPSTracking />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route path="/ecoutes" element={<Navigate to="/ecoutes/live" replace />} />
                  <Route
                    path="/ecoutes/live"
                    element={
                      <SectionErrorBoundary>
                        <EcouteLive />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/ecoutes/enregistrement"
                    element={
                      <SectionErrorBoundary>
                        <Enregistrement />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/statistiques"
                    element={
                      <SectionErrorBoundary>
                        <Statistiques />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/gamification/*"
                    element={
                      <SectionErrorBoundary>
                        <Gamification />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/kiosk"
                    element={
                      <SectionErrorBoundary>
                        <KioskOverview />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/kiosk/tablettes"
                    element={
                      <SectionErrorBoundary>
                        <KioskDevicesPage />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/kiosk/releases"
                    element={
                      <SectionErrorBoundary>
                        <KioskReleasesPage />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/kiosk/deploiements"
                    element={
                      <SectionErrorBoundary>
                        <KioskDeploymentsPage />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/kiosk/logs"
                    element={
                      <SectionErrorBoundary>
                        <KioskLogsPage />
                      </SectionErrorBoundary>
                    }
                  />
                  <Route
                    path="/kiosk/localisation"
                    element={
                      <SectionErrorBoundary>
                        <KioskLocationPage />
                      </SectionErrorBoundary>
                    }
                  />
                </Routes>
              </Suspense>
            </div>
          </SidebarInset>
          <GlobalSearchDialog />
        </SidebarProvider>
      </DetailsSectionsProvider>
    </ErrorBoundary>
  )
}
// Layout pour Commercial (sans sidebar, interface mobile) && light mode pour les pages commerciales
function CommercialLayout() {
  return (
    <ErrorBoundary>
      <div className="light" data-theme="light">
        <Suspense fallback={null}>
          <Routes>
            {/* Toutes les routes sous CommercialLayout pour éviter les déconnexions LiveKit */}
            <Route element={<CommercialLayoutComponent />}>
              <Route path="/" element={<CommercialDashboard />} />
              <Route path="/immeubles" element={<ImmeublesList />} />
              <Route path="/historique" element={<Historique />} />
              <Route path="/equipe" element={<TeamManagement />} />
              <Route path="/portes/:immeubleId" element={<PortesGestion />} />
              <Route path="/portes/lecture/:immeubleId" element={<PortesLecture />} />
            </Route>

            {/* Fallback */}
            <Route path="/*" element={<CommercialDashboard />} />
          </Routes>
        </Suspense>
      </div>
    </ErrorBoundary>
  )
}

// Composant principal qui route selon le rôle
function AppRouter() {
  const { isCommercial, isManager, isAuthenticated } = useRole()
  const location = useLocation()

  // Si l'utilisateur n'est pas authentifié, rediriger vers login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Si l'utilisateur est commercial, afficher l'interface dédiée
  if (isCommercial || isManager) {
    return <CommercialLayout />
  }

  // Sinon, afficher l'interface admin/manager/directeur
  return <AdminLayout />
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppLoadingProvider>
          <RoleProvider>
            <SessionManager />
            <OfflineSyncProvider>
              <Suspense fallback={null}>
                <Routes>
                  {/* Routes publiques */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/unauthorized" element={<Unauthorized />} />

                  {/* Routes protégées */}
                  <Route path="/*" element={<AppRouter />} />
                </Routes>
              </Suspense>
            </OfflineSyncProvider>
          </RoleProvider>
        </AppLoadingProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
