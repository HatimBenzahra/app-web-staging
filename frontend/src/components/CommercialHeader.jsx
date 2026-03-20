import React from 'react'
import { Badge } from '@/components/ui/badge'
import { User, Calendar, Award, Crown, Star, Gem, Trophy, MapPin } from 'lucide-react'
import { calculateRank } from '@/utils/business/ranks'

export default function CommercialHeader({
  commercial,
  showGreeting = true,
  stats,
  pageTitle = null,
  currentZone,
}) {
  // Récupérer la zone assignée
  const assignedZone = currentZone || commercial?.zones?.[0]
  // Système de badges unifié basé sur les points
  const getBadgeInfo = stats => {
    const contratsSignes = stats?.contratsSignes || 0
    const rendezVousPris = stats?.rendezVousPris || 0
    const immeublesVisites = stats?.immeublesVisites || 0

    // Calculer le rang avec le système unifié
    const { rank, points } = calculateRank(contratsSignes, rendezVousPris, immeublesVisites)

    // Mapper les rangs aux couleurs et icônes
    const rankStyles = {
      Bronze: {
        color: 'bg-gradient-to-r from-orange-600 to-red-600 text-white',
        icon: Award,
      },
      Silver: {
        color: 'bg-gradient-to-r from-gray-300 to-gray-500 text-white',
        icon: Award,
      },
      Gold: {
        color: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white',
        icon: Trophy,
      },
      Platinum: {
        color: 'bg-gradient-to-r from-blue-400 to-purple-400 text-white',
        icon: Star,
      },
      Diamond: {
        color: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white',
        icon: Gem,
      },
    }

    const style = rankStyles[rank.name] || rankStyles.Bronze

    return {
      level: rank.name,
      points,
      color: style.color,
      icon: style.icon,
    }
  }

  const badgeInfo = getBadgeInfo(stats)
  const currentDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const currentTime = new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (!showGreeting) return null

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 sm:px-6 py-4 sm:py-6 rounded-b-3xl shadow-2xl overflow-hidden">
      {/* Layout Mobile - Stack vertical */}
      <div className="flex flex-col sm:hidden space-y-3">
        {/* Top row: Avatar + Nom + Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold text-white truncate">
                Bonjour {commercial?.prenom || 'Commercial'} !
              </h1>
              {pageTitle && (
                <p className="text-xs text-blue-100 font-medium truncate">{pageTitle}</p>
              )}
            </div>
          </div>
          <Badge
            className={`${badgeInfo.color} border-none shadow-xl flex items-center space-x-1 px-2 py-1 flex-shrink-0`}
          >
            <badgeInfo.icon className="w-3 h-3" />
            <span className="font-bold text-xs whitespace-nowrap">
              {badgeInfo.level}
              <span className="text-[10px] opacity-75 ml-1">({badgeInfo.points}pts)</span>
            </span>
          </Badge>
        </div>

        {/* Bottom row: Date et stats */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 text-blue-50">
            <Calendar className="w-3 h-3" />
            <span>{currentTime}</span>
            {assignedZone && (
              <>
                <span className="text-blue-100">•</span>
                <MapPin className="w-3 h-3" />
                <span className="truncate">{assignedZone.nom}</span>
              </>
            )}
          </div>
          {stats?.contratsSignes !== undefined && (
            <span className="text-xs text-blue-50 font-medium">
              {stats.contratsSignes} contrats
            </span>
          )}
        </div>
      </div>

      {/* Layout Desktop/Tablet - Horizontal */}
      <div className="hidden sm:flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold text-white">
                Bonjour {commercial?.prenom || 'Commercial'} !
              </h1>
              {pageTitle && (
                <>
                  <span className="text-blue-200">•</span>
                  <span className="text-sm md:text-base text-blue-100 font-medium">
                    {pageTitle}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center space-x-2 text-blue-50 text-xs md:text-sm">
              <Calendar className="w-4 h-4" />
              <span className="capitalize hidden md:inline">{currentDate}</span>
              <span className="md:hidden">
                {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
              <span className="text-blue-100">•</span>
              <span>{currentTime}</span>
              {assignedZone && (
                <>
                  <span className="text-blue-100">•</span>
                  <MapPin className="w-4 h-4" />
                  <span>{assignedZone.nom}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end space-y-1">
          <Badge
            className={`${badgeInfo.color} border-none shadow-xl flex items-center space-x-1 px-3 py-1.5`}
          >
            <badgeInfo.icon className="w-4 h-4" />
            <span className="font-bold text-sm">
              {badgeInfo.level}
              <span className="text-xs opacity-75 ml-1.5">({badgeInfo.points}pts)</span>
            </span>
          </Badge>
          <div className="flex flex-col items-end space-y-0.5">
            {stats?.contratsSignes !== undefined && (
              <span className="text-xs text-blue-50 font-medium text-right">
                {stats.contratsSignes} contrats signés
              </span>
            )}
            {commercial?.email && (
              <span className="text-xs text-blue-100 text-right hidden lg:inline">
                {commercial.email}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
