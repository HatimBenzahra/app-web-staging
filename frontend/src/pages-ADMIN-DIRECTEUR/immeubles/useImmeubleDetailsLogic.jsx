import { useParams, Link } from 'react-router-dom'
import { useImmeuble, useCommercials, useManagers, useInfinitePortesByImmeuble } from '@/services'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Mic } from 'lucide-react'
import { getStatusLabel, getStatusColor } from '@/constants/domain/porte-status'
import {
  effectiveTypeHabitat,
  getHabitatMeta,
  buildingDoorCount,
  TypeHabitat,
} from '@/constants/domain/habitat'
import { porteApi } from '@/services/api/portes/porte.service'

export function useImmeubleDetailsLogic() {
  const { id } = useParams()

  // API hooks
  const { data: immeuble, loading: immeubleLoading, error } = useImmeuble(parseInt(id))
  const { data: commercials } = useCommercials()
  const { data: managers } = useManagers()

  // Utiliser useInfinitePortesByImmeuble avec une grande pageSize pour charger toutes les portes
  // pageSize=10000 devrait couvrir même les très grands immeubles
  const { data: portes, loading: portesLoading } = useInfinitePortesByImmeuble(
    parseInt(id),
    10000,
    null
  )

  const [segments, setSegments] = useState([])

  useEffect(() => {
    if (!id) return
    let active = true
    porteApi
      .getRecordingSegmentsByImmeuble(parseInt(id))
      .then(data => {
        if (active) setSegments(data)
      })
      .catch(() => {
        if (active) setSegments([])
      })
    return () => {
      active = false
    }
  }, [id])

  const porteSegmentCounts = useMemo(() => {
    const counts = new Map()
    for (const seg of segments) {
      counts.set(seg.porteId, (counts.get(seg.porteId) || 0) + 1)
    }
    return counts
  }, [segments])

  // Transformation des données API vers format UI
  const immeubleData = useMemo(() => {
    if (!immeuble) return null

    const type = effectiveTypeHabitat(immeuble)
    const meta = getHabitatMeta(type)
    const commercial = commercials?.find(c => c.id === immeuble.commercialId)
    const manager = managers?.find(m => m.id === immeuble.managerId)
    const totalDoors = portes?.length || buildingDoorCount(immeuble)

    // Déterminer le responsable (commercial ou manager)
    let commercialName = 'Non assigné'
    if (commercial) {
      commercialName = `${commercial.prenom} ${commercial.nom}`
    } else if (manager) {
      commercialName = `${manager.prenom} ${manager.nom} (Manager)`
    }

    // Nombre d'unités selon le type : étages (immeuble), 1 foyer (maison), maisons (pavillon)
    let unitCount
    if (type === TypeHabitat.MAISON) {
      unitCount = 1
    } else if (type === TypeHabitat.PAVILLON) {
      unitCount = immeuble.nbMaisonsPrevu ?? 0
    } else {
      unitCount = immeuble.nbEtages ?? 0
    }

    const mapPorte = porte => ({
      id: porte.id,
      number: porte.numero,
      nomPersonnalise: porte.nomPersonnalise || null,
      status: porte.statut.toLowerCase(),
      rdvDate: porte.rdvDate || null,
      rdvTime: porte.rdvTime || null,
      comment: porte.commentaire || null,
      lastVisit: porte.updatedAt || null,
      nbRepassages: porte.nbRepassages || 0,
      nbContrats: porte.nbContrats || 0,
    })

    // Regrouper les portes par unité à partir des vraies données.
    // MAISON : un foyer unique regroupe toutes les portes ; sinon groupement par étage/maison.
    let floorDetails = []
    if (portes) {
      if (type === TypeHabitat.MAISON) {
        floorDetails = [
          {
            floor: 1,
            unitLabel: meta.unitLabel,
            totalDoors: portes.length,
            doors: portes.map(mapPorte),
          },
        ]
      } else {
        floorDetails = Array.from({ length: unitCount }, (_, index) => {
          const unitNumber = index + 1
          const portesUnit = portes.filter(p => p.etage === unitNumber)
          return {
            floor: unitNumber,
            unitLabel: meta.unitLabel,
            totalDoors: portesUnit.length,
            doors: portesUnit.map(mapPorte),
          }
        })
      }
    }

    return {
      ...immeuble,
      effectiveType: type,
      name: immeuble.adresse.split(',')[0],
      address: immeuble.adresse,
      floors: immeuble.nbEtages,
      apartments: totalDoors,
      commercial_name: commercialName,
      has_elevator: immeuble.ascenseurPresent,
      digital_code: immeuble.digitalCode || 'Non défini',
      zone: immeuble.adresse.split(',')[1]?.trim() || 'Non spécifiée',
      created_at: immeuble.createdAt,
      updated_at: immeuble.updatedAt,
      floorDetails,
    }
  }, [immeuble, commercials, managers, portes])

  const habitatMeta = useMemo(
    () => getHabitatMeta(immeubleData?.effectiveType),
    [immeubleData?.effectiveType]
  )

  // Préparer les données pour le tableau - DOIT être après immeubleData mais avant les returns conditionnels
  const doorsData = useMemo(() => {
    if (!immeubleData?.floorDetails) return []

    const allDoors = []
    const isMaison = immeubleData.effectiveType === TypeHabitat.MAISON
    immeubleData.floorDetails.forEach(floor => {
      const unitLabel = isMaison ? floor.unitLabel : `${floor.unitLabel} ${floor.floor}`
      floor.doors.forEach(door => {
        allDoors.push({
          ...door,
          floor: Number(floor.floor),
          floorLabel: unitLabel,
          porteId: door.id, // ID de la base de données pour l'historique
          tableId: `${floor.floor}-${door.number}`, // Clé unique pour le tableau React
          etage: unitLabel,
          rdvTimestamp: door.rdvDate ? new Date(door.rdvDate).getTime() : null,
          lastVisitTimestamp: door.lastVisit ? new Date(door.lastVisit).getTime() : null,
        })
      })
    })
    return allDoors
  }, [immeubleData?.floorDetails, immeubleData?.effectiveType])

  const formatRelativeDate = useCallback(dateValue => {
    if (!dateValue) return null
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(date)
    target.setHours(0, 0, 0, 0)

    const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Aujourd'hui"
    if (diffDays === 1) return 'Hier'
    if (diffDays > 1 && diffDays < 7) return `Il y a ${diffDays}j`
    if (diffDays < 0) return `Dans ${Math.abs(diffDays)}j`

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  }, [])

  const formatDateLabel = useCallback(dateValue => {
    if (!dateValue) return null
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }, [])

  const personalInfo = useMemo(() => {
    if (!immeubleData) return []
    const type = immeubleData.effectiveType
    const info = [
      { label: 'Adresse complète', value: immeubleData.address, icon: 'mapPin' },
      { label: 'Zone', value: immeubleData.zone, icon: 'mapPin' },
      { label: 'Commercial responsable', value: immeubleData.commercial_name, icon: 'users' },
      { label: 'Type de bâtiment', value: habitatMeta.label, icon: 'building' },
    ]

    if (type === TypeHabitat.MAISON) {
      info.push({ label: 'Configuration', value: 'Foyer unique (1 porte)', icon: 'building' })
    } else if (type === TypeHabitat.PAVILLON) {
      info.push({
        label: 'Nombre de maisons',
        value: immeubleData.nbMaisonsPrevu ?? 0,
        icon: 'building',
      })
    } else {
      info.push({ label: "Nombre d'étages", value: immeubleData.floors, icon: 'building' })
      info.push({
        label: 'Portes par étage',
        value: immeubleData.nbPortesParEtage,
        icon: 'building',
      })
      info.push({
        label: 'Ascenseur',
        value: immeubleData.has_elevator ? 'Oui' : 'Non',
        icon: 'building',
      })
    }

    info.push({ label: 'Code digital', value: immeubleData.digital_code, icon: 'key' })
    return info
  }, [immeubleData, habitatMeta.label])

  const statsCards = useMemo(() => {
    if (!immeubleData) return []
    return [
      {
        title: 'Contrats signés',
        value: immeubleData.floorDetails.reduce(
          (acc, floor) => acc + floor.doors.filter(door => door.status === 'contrat_signe').length,
          0
        ),
        description: `Sur ${immeubleData.apartments} portes totales`,
        icon: 'trendingUp',
      },
      {
        title: 'RDV programmés',
        value: immeubleData.floorDetails.reduce(
          (acc, floor) =>
            acc + floor.doors.filter(door => door.status === 'rendez_vous_pris').length,
          0
        ),
        description: 'Rendez-vous à venir',
        icon: 'calendar',
      },
      {
        title: 'Absents',
        value: immeubleData.floorDetails.reduce(
          (acc, floor) => acc + floor.doors.filter(door => door.status === 'absent').length,
          0
        ),
        description: 'Personne absente',
        icon: 'users',
      },
      {
        title: 'Argumentés',
        value: immeubleData.floorDetails.reduce(
          (acc, floor) => acc + floor.doors.filter(door => door.status === 'argumente').length,
          0
        ),
        description: 'Refus après argumentation',
        icon: 'message-square',
      },
      {
        title: 'Refus',
        value: immeubleData.floorDetails.reduce(
          (acc, floor) => acc + floor.doors.filter(door => door.status === 'refus').length,
          0
        ),
        description: 'Propositions refusées',
        icon: 'building',
      },
    ]
  }, [immeubleData])

  // Définir les colonnes du tableau
  const columns = useMemo(
    () => [
      {
        header: 'Porte',
        accessor: 'number',
        sortable: true,
        className: 'font-medium',
        cell: row => (
          <div className="leading-tight">
            <Link
              to={`/immeubles/${id}/portes/${row.porteId}`}
              className="text-primary hover:underline font-medium text-[13px]"
            >
              {row.number}
            </Link>
            {row.nomPersonnalise && (
              <div
                className="text-[11px] text-muted-foreground mt-1 truncate"
                title={row.nomPersonnalise}
              >
                {row.nomPersonnalise}
              </div>
            )}
          </div>
        ),
      },
      {
        header: habitatMeta.unitLabel,
        accessor: 'etage',
        sortKey: 'floor',
        sortable: true,
        className: 'text-[13px] tabular-nums',
        cell: row => <span className="tabular-nums">{row.floorLabel || row.etage}</span>,
      },
      {
        header: 'Statut',
        accessor: 'status',
        sortable: true,
        cell: row => {
          // Normaliser le statut et utiliser les helpers du fichier constants
          const normalizedStatus = row.status?.toUpperCase()
          const label = getStatusLabel(normalizedStatus)
          const colorClasses = getStatusColor(normalizedStatus)

          return <Badge className={`${colorClasses} text-[10px]`}>{label}</Badge>
        },
      },
      {
        header: 'RDV',
        accessor: 'rdvTimestamp',
        sortable: true,
        cell: row => {
          if (row.rdvDate && row.rdvTime) {
            const formattedDate = formatDateLabel(row.rdvDate)
            return (
              <div className="inline-flex items-center gap-2 rounded bg-primary/5 px-2 py-1">
                <CalendarDays className="h-3.5 w-3.5 text-primary/70" />
                <div className="text-[13px] tabular-nums leading-tight">
                  <div>{formattedDate}</div>
                  <div className="text-muted-foreground">{row.rdvTime}</div>
                </div>
              </div>
            )
          }
          return <span className="text-muted-foreground">-</span>
        },
      },
      {
        header: 'Repassages',
        accessor: 'nbRepassages',
        sortable: true,
        className: 'text-[13px] tabular-nums',
        cell: row => {
          const repassages = row.nbRepassages || 0
          const indicatorClass =
            repassages >= 3
              ? 'bg-red-500/80'
              : repassages >= 1
                ? 'bg-amber-500/80'
                : 'bg-muted-foreground/30'

          return (
            <div className="inline-flex items-center gap-2 tabular-nums">
              <span className={`h-2 w-2 rounded-full ${indicatorClass}`} />
              <span>{repassages}</span>
            </div>
          )
        },
      },
      {
        header: 'Contrats',
        accessor: 'nbContrats',
        sortable: true,
        className: 'text-[13px] tabular-nums',
        cell: row => <span className="tabular-nums">{row.nbContrats || 0}</span>,
      },
      {
        header: 'Dernière visite',
        accessor: 'lastVisitTimestamp',
        sortable: true,
        cell: row => {
          const formatted = formatRelativeDate(row.lastVisit)
          if (!formatted) {
            return <span className="text-muted-foreground">-</span>
          }
          return <span className="text-[12px] tabular-nums text-muted-foreground">{formatted}</span>
        },
      },
      {
        header: 'Audio',
        accessor: 'audio',
        cell: row => {
          const count = porteSegmentCounts.get(row.porteId) || 0
          if (count === 0) return <span className="text-muted-foreground">-</span>
          return (
            <Link
              to={`/immeubles/${id}/portes/${row.porteId}`}
              className="inline-flex items-center gap-1 text-primary hover:text-primary/80"
            >
              <Mic className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{count}</span>
            </Link>
          )
        },
      },
      {
        header: 'Commentaire',
        accessor: 'comment',
        cell: row => {
          if (row.comment) {
            const truncatedComment =
              row.comment.length > 60 ? `${row.comment.slice(0, 60).trim()}...` : row.comment
            return (
              <div
                className="max-w-xs text-sm wrap-break-word whitespace-normal"
                title={row.comment}
              >
                {truncatedComment}
              </div>
            )
          }
          return <span className="text-muted-foreground">-</span>
        },
      },
    ],
    [id, porteSegmentCounts, formatDateLabel, formatRelativeDate, habitatMeta.unitLabel]
  )

  const additionalSections = useMemo(
    () => [
      {
        title: habitatMeta.planTitle,
        description: 'Représentation du bâtiment et statut des portes',
        type: 'custom',
        render: () => {
          const meta = habitatMeta
          const PlanIcon = meta.Icon
          const type = immeubleData?.effectiveType
          const units = immeubleData?.floorDetails || []
          const nbMaisons = immeubleData?.nbMaisonsPrevu ?? 0
          const nbEtages = immeubleData?.floors ?? 0
          const nbPortesParEtage = immeubleData?.nbPortesParEtage ?? 0

          const subtitle =
            type === TypeHabitat.MAISON
              ? 'Maison individuelle · 1 porte'
              : type === TypeHabitat.PAVILLON
                ? `${nbMaisons} maison${nbMaisons > 1 ? 's' : ''} · 1 porte par maison`
                : `${nbEtages} étage${nbEtages > 1 ? 's' : ''} · ${nbPortesParEtage} portes/étage`

          const renderDoor = door => (
            <div
              key={door.id}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${getStatusColor((door.status || '').toUpperCase())}`}
            >
              <span className="font-semibold">Porte {door.number}</span>
              <span className="opacity-80">
                {getStatusLabel((door.status || '').toUpperCase())}
              </span>
            </div>
          )

          return (
            <div className="space-y-5">
              {/* Bandeau d'accent coloré : identification du type au premier coup d'œil */}
              <div
                className={`flex items-center gap-3 rounded-xl border ${meta.accentBorder} ${meta.accentBg} p-4`}
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl bg-background/70 ${meta.accentColor}`}
                >
                  <PlanIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
              </div>

              {/* Corps du plan, réellement différent selon le type */}
              {type === TypeHabitat.MAISON ? (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <PlanIcon className={`h-4 w-4 ${meta.accentColor}`} />
                    <h3 className="text-base font-semibold">Foyer unique</h3>
                  </div>
                  {units[0]?.doors?.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {units[0].doors.map(renderDoor)}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      1 porte · aucune donnée de prospection
                    </p>
                  )}
                </div>
              ) : type === TypeHabitat.PAVILLON ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {units.length ? (
                    units.map(unit => (
                      <div
                        key={unit.floor}
                        className="rounded-xl border border-border/60 bg-muted/20 p-4"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <PlanIcon className={`h-4 w-4 ${meta.accentColor}`} />
                          <h3 className="text-sm font-semibold">Maison {unit.floor}</h3>
                        </div>
                        {unit.doors.length ? (
                          <div className="space-y-1.5">{unit.doors.map(renderDoor)}</div>
                        ) : (
                          <p className="text-xs text-muted-foreground">1 porte</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune maison renseignée</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {units.length ? (
                    units.map(floor => (
                      <div
                        key={floor.floor}
                        className="rounded-xl border border-border/60 bg-muted/20 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <PlanIcon className={`h-4 w-4 ${meta.accentColor}`} />
                            <h3 className="text-sm font-semibold">Étage {floor.floor}</h3>
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {floor.totalDoors} porte{floor.totalDoors > 1 ? 's' : ''}
                          </span>
                        </div>
                        {floor.doors.length ? (
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {floor.doors.map(renderDoor)}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Aucune porte sur cet étage
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun étage renseigné</p>
                  )}
                </div>
              )}
            </div>
          )
        },
      },
      ...(segments.length > 0
        ? [
            {
              title: 'Enregistrements',
              description: `${segments.length} segment${segments.length > 1 ? 's' : ''} audio pour cet immeuble`,
              type: 'custom',
              render: () => (
                <div className="divide-y max-h-96 overflow-y-auto">
                  {segments.map(seg => (
                    <Link
                      key={seg.id}
                      to={`/immeubles/${id}/portes/${seg.porteId}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors group"
                    >
                      <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Mic className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">Porte {seg.porteNumero}</span>
                          <span className="text-xs text-muted-foreground">
                            Ét. {seg.porteEtage}
                          </span>
                          {seg.statut && (
                            <Badge
                              className={`text-[10px] px-1.5 py-0 h-4 ${getStatusColor(seg.statut)}`}
                            >
                              {getStatusLabel(seg.statut)}
                            </Badge>
                          )}
                        </div>
                        {seg.transcription && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {seg.transcription}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {seg.speechScore != null && (
                          <span
                            className={`text-xs font-medium ${seg.speechScore >= 70 ? 'text-emerald-600' : seg.speechScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}
                          >
                            {seg.speechScore}%
                          </span>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          {Math.floor(seg.durationSec / 60)}:
                          {String(Math.floor(seg.durationSec % 60)).padStart(2, '0')}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ),
            },
          ]
        : []),
      {
        title: 'Tableau des portes',
        description: 'Statut de prospection pour chaque porte',
        type: 'custom',
        component: 'DoorsTable',
        data: {
          doors: doorsData,
          columns,
          customFilters: [
            { value: 'all', label: 'Tous les statuts' },
            { value: 'contrat_signe', label: 'Contrats signés' },
            { value: 'rendez_vous_pris', label: 'RDV programmés' },
            { value: 'absent', label: 'Absents' },
            { value: 'argumente', label: 'Argumentés' },
            { value: 'refus', label: 'Refus' },
            { value: 'necessite_repassage', label: 'Repassages nécessaires' },
            { value: 'non_visite', label: 'Non visités' },
          ],
        },
      },
    ],
    [doorsData, columns, segments, id, habitatMeta, immeubleData]
  )

  return {
    immeubleData,
    immeubleLoading,
    portesLoading,
    error,
    personalInfo,
    statsCards,
    additionalSections,
    habitatMeta,
  }
}
