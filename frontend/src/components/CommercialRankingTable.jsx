import React, { useMemo, useState } from 'react'
import { useRole } from '@/contexts/userole'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, Medal, Award, Star, Users, Crown, Shield } from 'lucide-react'
import { calculateRank } from '@/utils/business/ranks'

const formatNumber = num => {
  if (typeof num !== 'number') return '0'
  return new Intl.NumberFormat('fr-FR').format(num)
}

const getRankIcon = position => {
  switch (position) {
    case 1:
      return <Trophy className="h-4 w-4 text-yellow-500" />
    case 2:
      return <Medal className="h-4 w-4 text-gray-400" />
    case 3:
      return <Award className="h-4 w-4 text-orange-600" />
    default:
      return <Star className="h-4 w-4 text-blue-500" />
  }
}

/**
 * Tableau de classement multi-rôles (commerciaux, directeurs, managers)
 * @param {Object} props
 * @param {Array} props.commercials - Liste des commerciaux
 * @param {Array} props.directeurs - Liste des directeurs
 * @param {Array} props.managers - Liste des managers
 * @param {Array} props.statistics - Statistiques pour calculer les performances
 * @param {string} props.title - Titre du tableau
 * @param {string} props.description - Description du tableau
 * @param {number} props.limit - Nombre max d'utilisateurs à afficher
 */
export default function CommercialRankingTable({
  commercials = [],
  directeurs = [],
  managers = [],
  statistics = [],
  title = 'Classement des performances',
  description = 'Classement basé sur les performances par rôle',
  limit = 10,
}) {
  const { currentRole } = useRole()
  const [selectedType, setSelectedType] = useState('commercials')

  const activeCommercials = useMemo(
    () => commercials.filter(commercial => commercial.status === 'ACTIF'),
    [commercials]
  )
  const activeDirecteurs = useMemo(
    () => directeurs.filter(directeur => directeur.status === 'ACTIF'),
    [directeurs]
  )
  const activeManagers = useMemo(
    () => managers.filter(manager => manager.status === 'ACTIF'),
    [managers]
  )

  // Filtrer les types d'utilisateurs selon le rôle connecté
  const availableUserTypes = [
    {
      key: 'commercials',
      label: 'Commerciaux',
      icon: Users,
      data: activeCommercials,
      color: 'blue',
      allowedRoles: ['admin', 'directeur', 'manager'], // Tous peuvent voir les commerciaux
    },
    {
      key: 'directeurs',
      label: 'Directeurs',
      icon: Crown,
      data: activeDirecteurs,
      color: 'purple',
      allowedRoles: ['admin'], // Seul l'admin peut voir les directeurs
    },
    {
      key: 'managers',
      label: 'Managers',
      icon: Shield,
      data: activeManagers,
      color: 'green',
      allowedRoles: ['admin', 'directeur'], // Admin et directeurs peuvent voir les managers
    },
  ]

  const userTypes = availableUserTypes.filter(type => type.allowedRoles.includes(currentRole))

  // S'assurer que le type sélectionné est valide pour le rôle actuel
  const validSelectedType = userTypes.find(type => type.key === selectedType)
    ? selectedType
    : userTypes[0]?.key || 'commercials'

  const currentUserType = userTypes.find(type => type.key === validSelectedType)

  // Vérifier si les statistiques globales sont disponibles
  const hasGlobalStats = useMemo(() => Boolean(statistics?.length), [statistics])

  // Grouper les statistiques par commercial pour éviter les filtres répétés
  const statisticsByCommercial = useMemo(() => {
    const map = new Map()
    statistics.forEach(stat => {
      if (stat.commercialId) {
        if (!map.has(stat.commercialId)) {
          map.set(stat.commercialId, [])
        }
        map.get(stat.commercialId).push(stat)
      }
    })
    return map
  }, [statistics])

  // Grouper les statistiques par manager
  const statisticsByManager = useMemo(() => {
    const map = new Map()
    statistics.forEach(stat => {
      if (stat.managerId) {
        if (!map.has(stat.managerId)) {
          map.set(stat.managerId, [])
        }
        map.get(stat.managerId).push(stat)
      }
    })
    return map
  }, [statistics])

  // Grouper les commerciaux par directeur
  const commercialsByDirecteur = useMemo(() => {
    const map = new Map()
    activeCommercials.forEach(commercial => {
      if (commercial.directeurId) {
        if (!map.has(commercial.directeurId)) {
          map.set(commercial.directeurId, [])
        }
        map.get(commercial.directeurId).push(commercial)
      }
    })
    return map
  }, [activeCommercials])



  // Fonction helper pour obtenir les statistiques d'un utilisateur
  const getStatisticsForUser = (user, userType) => {
    switch (userType) {
      case 'commercials':
        if (hasGlobalStats) {
          return statisticsByCommercial.get(user.id) || []
        }
        return user.statistics || []

      case 'directeurs':
        if (hasGlobalStats) {
          const directeurCommercials = commercialsByDirecteur.get(user.id) || []
          return directeurCommercials.flatMap(
            commercial => statisticsByCommercial.get(commercial.id) || []
          )
        }
        return (commercialsByDirecteur.get(user.id) || []).flatMap(
          commercial => commercial.statistics || []
        )

      case 'managers':
        if (hasGlobalStats) {
          const managerStats = statisticsByManager.get(user.id) || []
          // Retourner uniquement les statistiques personnelles (sans commercialId)
          return managerStats.filter(stat => !stat.commercialId)
        }
        // Retourner les statistiques personnelles du manager
        return (user.statistics || []).filter(stat => !stat.commercialId)

      default:
        return []
    }
  }

  const rankedUsers = useMemo(() => {
    const currentData = currentUserType?.data || []
    if (!currentData?.length) return []

    // Calculer les performances pour chaque utilisateur
    const userStats = currentData.map(user => {
      const userStatistics = getStatisticsForUser(user, validSelectedType)

      // Calculer les totaux
      const totals = userStatistics.reduce(
        (acc, stat) => ({
          contratsSignes: acc.contratsSignes + (stat.contratsSignes || 0),
          rendezVousPris: acc.rendezVousPris + (stat.rendezVousPris || 0),
          immeublesVisites: acc.immeublesVisites + (stat.immeublesVisites || 0),
          refus: acc.refus + (stat.refus || 0),
        }),
        { contratsSignes: 0, rendezVousPris: 0, immeublesVisites: 0, refus: 0 }
      )

      // Calculer le rang et les points
      const { rank, points } = calculateRank(
        totals.contratsSignes,
        totals.rendezVousPris,
        totals.immeublesVisites
      )

      // Calculer le taux de conversion
      const totalActivites = totals.contratsSignes + totals.rendezVousPris + totals.refus
      const tauxConversion =
        totalActivites > 0 ? Math.round((totals.contratsSignes / totalActivites) * 100) : 0

      return {
        ...user,
        ...totals,
        rank,
        points,
        tauxConversion,
        name: `${user.prenom} ${user.nom}`,
        initials: `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase(),
        userType: validSelectedType,
      }
    })

    // Trier par points (décroissant) puis par contrats signés
    return userStats
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        return b.contratsSignes - a.contratsSignes
      })
      .slice(0, limit)
      .map((user, index) => ({
        ...user,
        position: index + 1,
      }))
  }, [
    currentUserType,
    validSelectedType,
    limit,
    hasGlobalStats,
    statisticsByCommercial,
    statisticsByManager,
    commercialsByDirecteur,
  ])

  if (!rankedUsers.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>

          {/* Sélecteur de type d'utilisateur */}
          <div className="flex flex-nowrap sm:flex-wrap gap-2 mt-4 ">
            {userTypes.map(type => {
              const Icon = type.icon
              const isActive = validSelectedType === type.key
              const hasData = type.data && type.data.length > 0

              return (
                <Button
                  key={type.key}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  disabled={!hasData}
                  onClick={() => setSelectedType(type.key)}
                  className={`flex items-center gap-2 ${!hasData ? 'opacity-50' : ''}`}
                >
                  <Icon className="h-4 w-4" />
                  {type.label}
                  {hasData && (
                    <Badge variant="secondary" className="ml-1">
                      {type.data.length}
                    </Badge>
                  )}
                </Button>
              )
            })}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Aucune donnée disponible pour {currentUserType?.label?.toLowerCase()}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>

        {/* Sélecteur de type d'utilisateur */}
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-2 gap-2 mt-4">
          {userTypes.map(type => {
            const Icon = type.icon
            const isActive = validSelectedType === type.key
            const hasData = type.data && type.data.length > 0

            return (
              <Button
                key={type.key}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                disabled={!hasData}
                onClick={() => setSelectedType(type.key)}
                className={`flex items-center justify-center gap-2 w-full p-2 ${!hasData ? 'opacity-50' : ''}`}
              >
                <Icon className="h-4 w-4" />
                {type.label}
                {hasData && (
                  <Badge variant="secondary" className="ml-1">
                    {type.data.length}
                  </Badge>
                )}
              </Button>
            )
          })}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Pos.</TableHead>
              <TableHead>{currentUserType?.label?.slice(0, -1) || 'Utilisateur'}</TableHead>
              <TableHead>Rang</TableHead>
              <TableHead className="text-center">Points</TableHead>
              <TableHead className="text-center">Contrats</TableHead>
              <TableHead className="text-center">RDV</TableHead>
              <TableHead className="text-center">Taux Conv.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rankedUsers.map(user => {
              const userTypeConfig = userTypes.find(t => t.key === user.userType)
              const userColor = userTypeConfig?.color || 'blue'

              return (
                <TableRow key={user.id} className={user.position <= 3 ? 'bg-muted/50' : ''}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getRankIcon(user.position)}
                      {user.position}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${userColor === 'blue'
                          ? 'bg-blue-100 text-blue-700'
                          : userColor === 'purple'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-green-100 text-green-700'
                          }`}
                      >
                        {user.initials}
                      </div>
                      <div className="grid gap-1">
                        <div className="font-medium leading-none">{user.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {currentUserType?.label?.slice(0, -1)} • ID: {user.id}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      className={`${user.rank.bgColor} ${user.rank.textColor} ${user.rank.borderColor} border font-semibold`}
                    >
                      {user.rank.name}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-center font-mono">
                    {formatNumber(user.points)}
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge className="bg-green-100 text-green-800">
                      {formatNumber(user.contratsSignes)}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge className="bg-blue-100 text-blue-800">
                      {formatNumber(user.rendezVousPris)}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-center">
                    <span
                      className={`font-medium ${user.tauxConversion >= 20
                        ? 'text-green-600'
                        : user.tauxConversion >= 10
                          ? 'text-yellow-600'
                          : 'text-red-600'
                        }`}
                    >
                      {user.tauxConversion}%
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
