import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react'
import GameIcon from '@/components/gamification/GameIcon'
import { MapSkeleton, DetailsPageSkeleton } from '@/components/LoadingSkeletons'
import DateRangeFilter from '@/components/DateRangeFilter'
import ProspectionChartsSection from '@/components/details/ProspectionChartsSection'
import CoachingSynthesisSection from '@/pages-ADMIN-DIRECTEUR/coaching/CoachingSynthesisSection'
import BuildingFacadeModal from '@/pages-ADMIN-DIRECTEUR/immeubles/components/BuildingFacadeModal'
import CommercialTrajetsSection from './components/CommercialTrajetsSection'
import CommercialZoneHistorySection from './components/CommercialZoneHistorySection'
import CommercialContratsSection from './components/CommercialContratsSection'
import { useCommercialDetailsLogic } from './useCommercialDetailsLogic'

const AssignedZoneCard = lazy(() => import('@/components/AssignedZoneCard'))

// Séparateur ajustable coaching/stats : largeur (%) de la colonne gauche, mémorisée.
const SPLIT_KEY = 'commercialDetail.splitPct'
const SPLIT_MIN = 28
const SPLIT_MAX = 65
const clampSplit = pct => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct))

/** `true` dès que l'écran atteint le breakpoint `xl` (layout 2 colonnes côte à côte). */
function useIsXl() {
  const [isXl, setIsXl] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const sync = () => setIsXl(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return isXl
}

function StatTile({ iconName, label, value, hint, valueClassName }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={`mt-2 text-2xl font-bold tracking-tight ${valueClassName || ''}`}>
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground truncate">{hint}</p>}
        </div>
        {iconName && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/60 text-primary">
            <GameIcon name={iconName} size={20} />
          </div>
        )}
      </div>
    </div>
  )
}

function couvertureBadgeClass(value) {
  if (value >= 80)
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
  if (value >= 50) return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
  return 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300'
}

const BUILDINGS_PER_PAGE = 12

function BuildingsTable({ rows, onRowClick }) {
  const [page, setPage] = useState(0)

  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">Aucun bâtiment prospecté</p>
    )
  }

  const totalPages = Math.ceil(rows.length / BUILDINGS_PER_PAGE)
  const current = Math.min(page, totalPages - 1)
  const start = current * BUILDINGS_PER_PAGE
  const paged = rows.slice(start, start + BUILDINGS_PER_PAGE)

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adresse</TableHead>
                <TableHead className="text-center">Portes</TableHead>
                <TableHead className="text-center">Couverture</TableHead>
                <TableHead className="text-center">Contrats</TableHead>
                <TableHead className="text-center">RDV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(row => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick(row)}
                  className="cursor-pointer"
                  title="Voir la façade du bâtiment"
                >
                  <TableCell className="font-medium">{row.address}</TableCell>
                  <TableCell className="text-center tabular-nums">{row.total_doors}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={couvertureBadgeClass(row.couverture || 0)}>
                      {row.couverture || 0}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-green-100 text-green-800">
                      {row.contrats_signes || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-blue-100 text-blue-800">{row.rdv_pris || 0}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">
            {start + 1}–{Math.min(start + BUILDINGS_PER_PAGE, rows.length)} sur {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular-nums">
              {current + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={current >= totalPages - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="h-2 w-2 rounded-full bg-primary" />
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
    </div>
  )
}

export default function CommercialDetailView() {
  const {
    commercialData,
    loading,
    error,
    dateFilter,
    overview,
    perfStats,
    personalInfo,
    prospection,
    assignedZones,
    buildings,
    buildingModal,
  } = useCommercialDetailsLogic()

  const navigate = useNavigate()
  const [tab, setTab] = useState('batiments')

  // --- Séparateur ajustable coaching (gauche) / stats (droite), actif en xl+ ---
  const isXl = useIsXl()
  const splitRef = useRef(null)
  const [leftPct, setLeftPct] = useState(() => {
    if (typeof window === 'undefined') return 40
    const v = Number(window.localStorage.getItem(SPLIT_KEY))
    return Number.isFinite(v) && v >= SPLIT_MIN && v <= SPLIT_MAX ? v : 40
  })
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (!isDragging) return
    const onMove = e => {
      const el = splitRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.width === 0) return
      setLeftPct(clampSplit(((e.clientX - rect.left) / rect.width) * 100))
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''
    }
  }, [isDragging])

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(SPLIT_KEY, String(Math.round(leftPct)))
      } catch {
        /* localStorage indisponible : on ignore */
      }
    }, 300)
    return () => clearTimeout(t)
  }, [leftPct])

  if (loading) return <DetailsPageSkeleton />
  if (error) {
    return (
      <div className="p-6 border border-red-200 rounded-lg bg-red-50">
        <p className="text-red-800">Erreur lors du chargement des données : {error}</p>
      </div>
    )
  }
  if (!commercialData) {
    return (
      <div className="p-6 border border-gray-200 rounded-lg bg-gray-50">
        <p className="text-gray-800">Commercial non trouvé</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ---- Vue d'ensemble ---- */}
      <button
        type="button"
        onClick={() => navigate('/commerciaux')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Retour aux commerciaux
      </button>

      <Card className="border-border/60">
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight truncate">
                  {commercialData.name}
                </h1>
                <Badge variant="outline">Commercial</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Manager : {commercialData.managerName}
                {commercialData.rank?.name ? (
                  <>
                    {' · '}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${commercialData.rank.badgeClasses}`}
                    >
                      🏆 {commercialData.rank.name}
                    </span>
                  </>
                ) : null}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <GameIcon name="stopwatch" size={14} className="shrink-0" />
                <span className="truncate">
                  Dernière activité : {overview.lastActivityLabel}
                  <span className="opacity-70"> · {overview.lastActivityDesc}</span>
                </span>
              </p>
            </div>
            <DateRangeFilter
              className="h-fit"
              startDate={dateFilter.startDate}
              endDate={dateFilter.endDate}
              appliedStartDate={dateFilter.appliedStartDate}
              appliedEndDate={dateFilter.appliedEndDate}
              onChangeStart={dateFilter.setStartDate}
              onChangeEnd={dateFilter.setEndDate}
              onApply={dateFilter.handleApplyFilters}
              onReset={dateFilter.handleResetFilters}
              title="Période"
            />
          </div>

          {/* 4 chiffres clés — signés (terrain) vs validés (back-office) distingués */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              iconName="contract"
              label="Contrats signés"
              value={overview.contratsSignes}
              hint="Déclarés terrain"
            />
            <StatTile
              iconName="stamper"
              label="Contrats validés"
              value={overview.contratsValides}
              hint="Confirmés back-office"
            />
            <StatTile iconName="door" label="Couverture" value={`${overview.couverture}%`} />
            <StatTile iconName="chart" label="Points" value={overview.points} />
          </div>

          {/* Infos de contact (repli) */}
          <details className="group rounded-lg border border-border/60 bg-muted/30">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm font-medium">
              Infos de contact
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
              {personalInfo.map(info => (
                <div key={info.label}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {info.label}
                  </p>
                  <p className="text-sm font-medium break-words">{info.value}</p>
                </div>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Synthèse coaching + stats — responsive.
          xl+ : coaching à gauche (image globale) · stats à droite.
          < xl : stats d'abord (order-1), coaching en dessous (order-2) pour ne pas
          bloquer l'accès aux stats derrière un long pavé de texte. */}
      <div
        ref={splitRef}
        className="grid items-start gap-8 xl:gap-0"
        style={
          isXl
            ? {
                gridTemplateColumns: `minmax(0, ${leftPct}fr) 1.5rem minmax(0, ${100 - leftPct}fr)`,
              }
            : undefined
        }
      >
        <div className="order-2 min-w-0 xl:order-1">
          <CoachingSynthesisSection
            commercialId={commercialData.id}
            subjectName={commercialData.name}
          />
        </div>

        {/* Poignée de redimensionnement (xl uniquement) : glisser ou flèches ←/→ */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajuster la largeur des colonnes"
          aria-valuenow={Math.round(leftPct)}
          aria-valuemin={SPLIT_MIN}
          aria-valuemax={SPLIT_MAX}
          tabIndex={0}
          onPointerDown={() => setIsDragging(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              setLeftPct(p => clampSplit(p - 2))
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              setLeftPct(p => clampSplit(p + 2))
            }
          }}
          className="group relative hidden cursor-col-resize touch-none select-none items-center justify-center self-stretch outline-none xl:order-2 xl:flex"
        >
          {/* Ligne fine pleine hauteur, discrète au repos, bleue au survol/drag */}
          <div
            className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${
              isDragging ? 'bg-primary' : 'bg-border group-hover:bg-primary/50'
            }`}
          />
          {/* Prise centrale (affordance « glisser ») */}
          <div
            className={`relative z-10 flex h-10 w-5 items-center justify-center rounded-full border bg-background shadow-sm transition-colors ${
              isDragging
                ? 'border-primary text-primary'
                : 'border-border text-muted-foreground group-hover:border-primary group-hover:text-primary group-focus-visible:border-primary group-focus-visible:text-primary'
            }`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* ---- Onglets ---- */}
        <div className="order-1 min-w-0 xl:order-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="batiments">Bâtiments</TabsTrigger>
              <TabsTrigger value="perf">Perf &amp; prospection</TabsTrigger>
              <TabsTrigger value="contrats">Contrats</TabsTrigger>
              <TabsTrigger value="terrain">Terrain</TabsTrigger>
            </TabsList>

            {/* Bâtiments (onglet par défaut) */}
            <TabsContent value="batiments" className="space-y-4">
              <SectionTitle>Bâtiments prospectés</SectionTitle>
              <BuildingsTable rows={buildings.rows} onRowClick={buildings.onRowClick} />
            </TabsContent>

            {/* Perf & prospection */}
            <TabsContent value="perf" className="space-y-8">
              <div>
                <SectionTitle>Performance</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {perfStats.map(stat => (
                    <StatTile
                      key={stat.label}
                      label={stat.label}
                      value={stat.value}
                      hint={stat.hint}
                    />
                  ))}
                </div>
              </div>

              <div>
                <SectionTitle>Prospection</SectionTitle>
                <ProspectionChartsSection
                  charts={prospection.charts}
                  totalDoors={prospection.totalDoors}
                />
              </div>
            </TabsContent>

            {/* Contrats validés (offres WinLeadPlus) */}
            <TabsContent value="contrats" className="space-y-4">
              <SectionTitle>Contrats validés (WinLeadPlus)</SectionTitle>
              <CommercialContratsSection commercialId={commercialData.id} />
            </TabsContent>

            {/* Terrain (zones + GPS) */}
            <TabsContent value="terrain" className="@container space-y-8">
              <div className="grid gap-5 @3xl:grid-cols-2">
                <div>
                  <SectionTitle>Zone active</SectionTitle>
                  {assignedZones.length > 0 ? (
                    <Suspense fallback={<MapSkeleton />}>
                      {assignedZones.map(zone => (
                        <AssignedZoneCard
                          key={zone.id}
                          zone={zone}
                          assignmentDate={zone.assignmentDate || zone.createdAt}
                          immeublesCount={zone.immeublesCount || 0}
                        />
                      ))}
                    </Suspense>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Aucune zone assignée
                    </p>
                  )}
                </div>
                <div>
                  <SectionTitle>Historique des zones</SectionTitle>
                  <CommercialZoneHistorySection commercialId={commercialData.id} />
                </div>
              </div>

              <div>
                <SectionTitle>Trajets GPS</SectionTitle>
                <CommercialTrajetsSection
                  commercialId={commercialData.id}
                  commercialName={commercialData.name}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <BuildingFacadeModal
        open={buildingModal.open}
        onOpenChange={buildingModal.onOpenChange}
        facade={buildingModal.facade}
      />
    </div>
  )
}
