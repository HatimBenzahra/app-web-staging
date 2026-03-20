import { useParams, Link } from 'react-router-dom'
import { useImmeuble, useCommercials, useManagers, useInfinitePortesByImmeuble } from '@/services'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Mic } from 'lucide-react'
import { getStatusLabel, getStatusColor } from '@/constants/domain/porte-status'
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

    const commercial = commercials?.find(c => c.id === immeuble.commercialId)
    const manager = managers?.find(m => m.id === immeuble.managerId)
    const totalDoors = portes?.length || immeuble.nbEtages * immeuble.nbPortesParEtage

    // Déterminer le responsable (commercial ou manager)
    let commercialName = 'Non assigné'
    if (commercial) {
      commercialName = `${commercial.prenom} ${commercial.nom}`
    } else if (manager) {
      commercialName = `${manager.prenom} ${manager.nom} (Manager)`
    }

    // Grouper les portes par étage à partir des vraies données
    const floorDetails = portes
      ? Array.from({ length: immeuble.nbEtages }, (_, index) => {
          const floorNumber = index + 1
          const portesEtage = portes.filter(p => p.etage === floorNumber)

          return {
            floor: floorNumber,
            totalDoors: portesEtage.length,
            doors: portesEtage.map(porte => ({
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
            })),
          }
        })
      : []

    return {
      ...immeuble,
      name: `Immeuble ${immeuble.adresse.split(',')[0]}`,
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

  // Préparer les données pour le tableau - DOIT être après immeubleData mais avant les returns conditionnels
  const doorsData = useMemo(() => {
    if (!immeubleData?.floorDetails) return []

    const allDoors = []
    immeubleData.floorDetails.forEach(floor => {
      floor.doors.forEach(door => {
        allDoors.push({
          ...door,
          floor: Number(floor.floor),
          floorLabel: `Étage ${floor.floor}`,
          porteId: door.id, // ID de la base de données pour l'historique
          tableId: `${floor.floor}-${door.number}`, // Clé unique pour le tableau React
          etage: `Étage ${floor.floor}`,
          rdvTimestamp: door.rdvDate ? new Date(door.rdvDate).getTime() : null,
          lastVisitTimestamp: door.lastVisit ? new Date(door.lastVisit).getTime() : null,
        })
      })
    })
    return allDoors
  }, [immeubleData?.floorDetails])

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
    return [
      { label: 'Adresse complète', value: immeubleData.address, icon: 'mapPin' },
      { label: 'Zone', value: immeubleData.zone, icon: 'mapPin' },
      { label: 'Commercial responsable', value: immeubleData.commercial_name, icon: 'users' },
      { label: "Nombre d'étages", value: immeubleData.floors, icon: 'building' },
      { label: 'Portes par étage', value: immeubleData.nbPortesParEtage, icon: 'building' },
      { label: 'Ascenseur', value: immeubleData.has_elevator ? 'Oui' : 'Non', icon: 'building' },
      { label: 'Code digital', value: immeubleData.digital_code, icon: 'key' },
    ]
  }, [immeubleData])

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
              <div className="text-[11px] text-muted-foreground mt-1 truncate" title={row.nomPersonnalise}>
                {row.nomPersonnalise}
              </div>
            )}
          </div>
        ),
      },
      {
        header: 'Étage',
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
              <div className="max-w-xs text-sm wrap-break-word whitespace-normal" title={row.comment}>
                {truncatedComment}
              </div>
            )
          }
          return <span className="text-muted-foreground">-</span>
        },
      },
    ],
    [id, porteSegmentCounts, formatDateLabel, formatRelativeDate]
  )

  const additionalSections = useMemo(
    () => [
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
    [doorsData, columns, segments, id]
  )

  return {
    immeubleData,
    immeubleLoading,
    portesLoading,
    error,
    personalInfo,
    statsCards,
    additionalSections,
  }
}
