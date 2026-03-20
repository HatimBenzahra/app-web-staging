import {
  Home,
  ChevronDown,
  User2,
  Building2,
  MapPin,
  Navigation2,
  Headphones,
  BarChart3,
  Trophy,
  Users,
  ArrowLeft,
  LogOut,
  Shield,
  UserCog,
  Briefcase,
  Settings,
  Smartphone,
  LayoutDashboard,
  Tablet,
  Package,
  Rocket,
  ScrollText,
} from 'lucide-react'
import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import logoSvg from '@/assets/logo.svg'
import { useRole } from '@/contexts/userole'
import { hasPermission, ROLES } from '@/hooks/metier/permissions/roleFilters'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@radix-ui/react-collapsible'
import { useDetailsSections } from '@/contexts/DetailsSectionsContext'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar'

const mainItems = [{ title: 'Dashboard', url: '/', icon: Home, entity: 'dashboard' }]

const teamItems = [
  { title: 'Directeurs', url: '/directeurs', icon: Shield, entity: 'directeurs' },
  { title: 'Managers', url: '/managers', icon: UserCog, entity: 'managers' },
  { title: 'Commerciaux', url: '/commerciaux', icon: Briefcase, entity: 'commerciaux' },
  { title: 'Gestion', url: '/gestion', icon: Users, entity: 'gestion' },
]

const prospectionItems = [
  { title: 'Immeubles', url: '/immeubles', icon: Building2, entity: 'immeubles' },
  {
    title: 'Zones',
    url: '/zones',
    icon: MapPin,
    entity: 'zones',
    subitems: [
      { title: "Vue d'ensemble", url: '/zones' },
      { title: 'Assignations', url: '/zones/assignations' },
      { title: 'Historique', url: '/zones/historique' },
    ],
  },
  {
    title: 'Suivi GPS',
    url: '/gps-tracking',
    icon: Navigation2,
    entity: 'gps-tracking',
    disabled: true,
  },
]

const kioskItems = [
  { title: "Vue d'ensemble", url: '/kiosk', icon: LayoutDashboard, entity: 'kiosk', exact: true },
  { title: 'Tablettes', url: '/kiosk/tablettes', icon: Tablet, entity: 'kiosk' },
  { title: 'Releases', url: '/kiosk/releases', icon: Package, entity: 'kiosk' },
  { title: 'Déploiements', url: '/kiosk/deploiements', icon: Rocket, entity: 'kiosk' },
  { title: 'Logs', url: '/kiosk/logs', icon: ScrollText, entity: 'kiosk' },
  { title: 'Localisation', url: '/kiosk/localisation', icon: MapPin, entity: 'kiosk' },
]

const toolsItems = [
  {
    title: 'Écoutes',
    url: '/ecoutes',
    icon: Headphones,
    entity: 'ecoutes',
    subitems: [
      { title: 'Écoute Live', url: '/ecoutes/live' },
      { title: 'Enregistrements', url: '/ecoutes/enregistrement' },
    ],
  },
  {
    title: 'Gamification',
    url: '/gamification',
    icon: Trophy,
    entity: 'gamification',
    subitems: [
      { title: 'Classement', url: '/gamification' },
      { title: 'Badges', url: '/gamification/badges' },
      { title: 'Mapping', url: '/gamification/mapping' },
      { title: 'Offres', url: '/gamification/offres' },
      { title: 'Synchronisation', url: '/gamification/sync' },
    ],
  },
  { title: 'Statistiques', url: '/statistiques', icon: BarChart3, entity: 'statistics' },
]

const items = [...mainItems, ...teamItems, ...kioskItems, ...prospectionItems, ...toolsItems]

export function AppSidebar() {
  const { currentRole, logout } = useRole()
  const location = useLocation()
  const [openMenus, setOpenMenus] = React.useState({})
  const { sections, setFocusedSection } = useDetailsSections()
  const [activeSection, setActiveSection] = React.useState(null)

  const normalizePath = value => {
    if (!value) return ''
    return value.replace(/\/+$/, '') || '/'
  }

  const isActiveRoute = (path, subitems = [], exact = false) => {
    const currentPath = normalizePath(location.pathname)
    const targetPath = normalizePath(path)

    if (!targetPath) return false
    if (targetPath === '/') {
      return currentPath === '/'
    }

    if (exact) {
      return currentPath === targetPath
    }

    // Si cet item a des sous-items, vérifier s'il y a une correspondance plus spécifique
    // Pour éviter que le parent soit actif quand un enfant est actif
    if (subitems.length > 0) {
      const hasMoreSpecificMatch = subitems.some(
        sub =>
          currentPath === normalizePath(sub.url) ||
          currentPath.startsWith(`${normalizePath(sub.url)}/`)
      )

      // Si un sous-item correspond mieux, utiliser une correspondance exacte pour le parent
      if (hasMoreSpecificMatch && currentPath !== targetPath) {
        return false
      }
    }

    return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
  }

  // Fonction pour gérer le scroll vers une section
  const handleScrollToSection = sectionId => {
    const element = document.getElementById(sectionId)
    if (element) {
      // Définir la section comme focusée pour l'effet visuel
      setFocusedSection(sectionId)

      // Calculer la position pour centrer vraiment l'élément
      const elementRect = element.getBoundingClientRect()
      const absoluteElementTop = elementRect.top + window.pageYOffset
      const middle = absoluteElementTop - window.innerHeight / 2 + elementRect.height / 2

      window.scrollTo({
        top: middle,
        behavior: 'smooth',
      })

      // Retirer l'effet de focus après 2 secondes
      setTimeout(() => {
        setFocusedSection(null)
      }, 2000)
    }
  }

  // Enrichir les items du menu avec les sections dynamiques pour les pages de détails
  const enrichedItems = React.useMemo(() => {
    return items.map(item => {
      // Si on est sur une page de détails et qu'il y a des sections disponibles
      if (sections.length > 0 && location.pathname.includes(item.url) && item.url !== '/') {
        // Vérifier si on est sur une page de détail (avec un ID dans l'URL)
        const isDetailPage =
          location.pathname !== item.url && location.pathname.startsWith(item.url + '/')

        if (isDetailPage) {
          // Créer un premier sous-item pour retourner au tableau principal
          const backToListItem = {
            title: `Voir tous les ${item.title}`,
            url: item.url,
            isBackLink: true, // Marquer comme lien de retour
          }

          // Créer des sous-items à partir des sections
          const dynamicSubitems = sections.map(section => ({
            title: section.title,
            id: section.id,
            isSection: true, // Marquer comme section pour gérer différemment
          }))

          return {
            ...item,
            subitems: [backToListItem, ...dynamicSubitems], // Ajouter le lien de retour en premier
          }
        }
      }
      return item
    })
  }, [sections, location.pathname])

  // Ouvrir automatiquement le menu qui contient des sections dynamiques
  React.useEffect(() => {
    enrichedItems.forEach(item => {
      if (item.subitems && item.subitems.some(sub => sub.isSection)) {
        setOpenMenus(prev => ({ ...prev, [item.title]: true }))
      }
    })
  }, [enrichedItems])

  // Détecter la section active en fonction du scroll
  React.useEffect(() => {
    if (sections.length === 0) return

    const handleScroll = () => {
      // Vérifier si on est en bas de la page
      const isBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10

      // Si on est en bas, activer la dernière section
      if (isBottom && sections.length > 0) {
        setActiveSection(sections[sections.length - 1].id)
        return
      }

      // Récupérer toutes les sections
      const sectionElements = sections.map(section => ({
        id: section.id,
        element: document.getElementById(section.id),
      }))

      // Trouver quelle section est actuellement visible
      // On considère qu'une section est active si elle est dans le tiers supérieur de l'écran
      const scrollPosition = window.scrollY + 200

      let currentActiveSection = null

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const section = sectionElements[i]
        if (section.element) {
          const offsetTop = section.element.offsetTop
          if (scrollPosition >= offsetTop) {
            currentActiveSection = section.id
            break
          }
        }
      }
      if (!currentActiveSection && sections.length > 0) {
        currentActiveSection = sections[0].id
      }

      setActiveSection(currentActiveSection)
    }

    // Écouter les événements de scroll
    window.addEventListener('scroll', handleScroll)
    // Appeler une première fois pour initialiser
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [sections])

  const renderMenuItem = item => {
    if (item.subitems) {
      const isAnySubitemActive = item.subitems.some(sub => isActiveRoute(sub.url))
      return (
        <Collapsible
          key={item.title}
          open={openMenus[item.title] ?? isAnySubitemActive}
          onOpenChange={open => setOpenMenus(prev => ({ ...prev, [item.title]: open }))}
          className="group/collapsible"
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip={item.title}>
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.title}</span>
                <ChevronDown className="ml-auto h-3.5 w-3.5 text-sidebar-foreground/40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {item.subitems.map(subitem => (
                  <SidebarMenuSubItem key={subitem.title}>
                    {subitem.isSection ? (
                      <SidebarMenuSubButton
                        onClick={() => handleScrollToSection(subitem.id)}
                        isActive={activeSection === subitem.id}
                      >
                        <span>{subitem.title}</span>
                      </SidebarMenuSubButton>
                    ) : subitem.isBackLink ? (
                      <SidebarMenuSubButton
                        asChild
                        isActive={false}
                        className="font-semibold text-primary"
                      >
                        <Link to={subitem.url}>
                          <ArrowLeft className="h-3 w-3 mr-1" />
                          <span>{subitem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    ) : (
                      <SidebarMenuSubButton
                        asChild
                        isActive={isActiveRoute(subitem.url, item.subitems)}
                      >
                        <Link to={subitem.url}>
                          <span>{subitem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    )}
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      )
    }

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild={!item.disabled}
          isActive={isActiveRoute(item.url, item.subitems, item.exact)}
          disabled={item.disabled}
          tooltip={item.disabled ? 'Bientôt disponible' : item.title}
          className={cn(item.disabled && 'opacity-40 cursor-not-allowed')}
        >
          {item.disabled ? (
            <div className="flex w-full items-center gap-3">
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.title}</span>
            </div>
          ) : (
            <Link to={item.url} className="flex w-full items-center gap-3">
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.title}</span>
            </Link>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar collapsible="icon" data-sidebar="sidebar">
      <SidebarHeader className="pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-sidebar-accent/50">
              <Link to="/" className="gap-3">
                <img src={logoSvg} alt="Pro-Win" className="size-10 rounded-xl shadow-md" />
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-base font-bold tracking-tight">Pro-Win</span>
                  <span className="truncate text-[11px] text-sidebar-foreground/50 font-medium">
                    Prospection
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {[
          { label: 'Principal', items: mainItems },
          { label: 'Équipe', items: teamItems },
          { label: 'Kiosk', items: kioskItems },
          { label: 'Prospection', items: prospectionItems },
          { label: 'Outils', items: toolsItems },
        ].map((group, idx) => {
          const groupVisible = group.items.filter(
            item => !item.entity || hasPermission(currentRole, item.entity, 'view')
          )
          if (groupVisible.length === 0) return null
          return (
            <SidebarGroup
              key={group.label}
              className={idx > 0 ? 'border-t border-sidebar-border/50 pt-2' : ''}
            >
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {groupVisible.map(item => {
                    const enriched = enrichedItems.find(e => e.title === item.title) || item
                    return renderMenuItem(enriched)
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={`Utilisateur - ${currentRole}`}
              className="w-full"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-sidebar-primary/20 text-sidebar-primary">
                <User2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Utilisateur</span>
                <span className="truncate text-xs capitalize text-sidebar-foreground/50">
                  {currentRole}
                </span>
              </div>
              <LogOut
                className="h-4 w-4 text-sidebar-foreground/40 hover:text-destructive cursor-pointer transition-colors ml-auto"
                onClick={e => {
                  e.stopPropagation()
                  logout()
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
