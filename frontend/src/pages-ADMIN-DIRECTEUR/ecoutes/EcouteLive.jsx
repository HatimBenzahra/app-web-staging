import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BarVisualizer } from '@livekit/components-react'
import '@livekit/components-styles'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/Pagination'
import {
  Play,
  Square,
  Mic,
  Volume2,
  VolumeX,
  Radio,
  Search,
  Users,
  Activity,
  RotateCw,
  Clock,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEcouteLiveLogic } from './useEcouteLiveLogic'

function UserAvatar({ prenom, nom, userType }) {
  const initials = `${(prenom || '')[0] || ''}${(nom || '')[0] || ''}`.toUpperCase()
  const bg =
    userType === 'manager'
      ? 'bg-violet-500/15 text-violet-600'
      : 'bg-blue-500/15 text-blue-600'
  return (
    <div
      className={`flex items-center justify-center w-9 h-9 rounded-full font-semibold text-xs shrink-0 ${bg}`}
    >
      {initials}
    </div>
  )
}

function UserCard({
  user,
  isOnline,
  isListening,
  listeningData,
  audioTrack,
  isMuted,
  setIsMuted,
  onStart,
  onStop,
  userKey,
}) {
  return (
    <div
      className={`border rounded-xl transition-all duration-200 ${
        isListening
          ? 'border-red-500/30 bg-red-500/3'
          : 'border-border/60 hover:border-border hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <UserAvatar prenom={user.prenom} nom={user.nom} userType={user.userType} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">
              {user.prenom} {user.nom}
            </p>
            <Badge
              variant={user.userType === 'manager' ? 'secondary' : 'outline'}
              className="text-[10px] px-1.5 py-0 h-4 shrink-0"
            >
              {user.userType === 'manager' ? 'Manager' : 'Commercial'}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isListening ? (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-red-500">En ecoute</span>
                <span className="text-xs text-muted-foreground">
                  depuis {listeningData?.startTime}
                </span>
              </>
            ) : isOnline ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xs font-medium text-green-600">En ligne</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-muted-foreground/30 rounded-full" />
                <span className="text-xs text-muted-foreground">Hors ligne</span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {isListening ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onStop(userKey)}
              className="h-8 gap-1.5"
            >
              <Square className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Arreter</span>
            </Button>
          ) : (
            <Button
              variant={isOnline ? 'default' : 'outline'}
              size="sm"
              disabled={!isOnline}
              onClick={() => onStart(user)}
              className="h-8 gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ecouter</span>
            </Button>
          )}
        </div>
      </div>

      {isListening && listeningData && (
        <div className="border-t border-border/40 p-3 sm:p-4">
          <div className="bg-muted/30 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">
                  {user.prenom} {user.nom}
                </span>
                {listeningData.connectionDetails?.roomName && (
                  <Badge variant="outline" className="text-[10px] px-1.5 h-5">
                    {listeningData.connectionDetails.roomName}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{listeningData.startTime}</span>
              </div>
            </div>

            <div
              className="w-full"
              style={{
                '--lk-fg': 'hsl(0 85% 55%)',
                '--lk-va-bg': 'hsl(0 0% 50% / 0.2)',
              }}
            >
              <BarVisualizer
                track={audioTrack || undefined}
                barCount={48}
                options={{ minHeight: 5, maxHeight: 100 }}
                style={{ height: '56px', gap: '3px' }}
              />
            </div>

            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMuted(!isMuted)}
                className="h-8 gap-1.5"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
                <span className="text-xs">{isMuted ? 'Son coupe' : 'Son actif'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EcouteLive() {
  const {
    filteredUsers,
    currentUsers,
    loading,
    error,
    refetch,
    searchTerm,
    setSearchTerm,
    showOnlyOnline,
    setShowOnlyOnline,
    activeListeningRooms,
    audioTracks,
    isMuted,
    setIsMuted,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToNextPage,
    goToPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isUserOnline,
    handleStartListening,
    handleStopListening,
    statusFilter,
    setStatusFilter,
    statusFilterOptions,
  } = useEcouteLiveLogic()

  const onlineCount = filteredUsers.filter(u => isUserOnline(u.id, u.userType)).length

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10">
            <Radio className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ecoute en Live</h1>
            <p className="text-sm text-muted-foreground">Surveillance en temps reel</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-border/40 bg-muted/20 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10">
            <Radio className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ecoute en Live</h1>
            <p className="text-sm text-muted-foreground">Surveillance en temps reel</p>
          </div>
        </div>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-6">
            <p className="text-destructive font-medium">
              Erreur lors du chargement : {error}
            </p>
            <Button onClick={refetch} className="mt-3" variant="outline" size="sm">
              <RotateCw className="w-4 h-4 mr-2" />
              Reessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10">
          <Radio className="w-5 h-5 text-red-500" />
          {activeListeningRooms.size > 0 && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ecoute en Live</h1>
          <p className="text-sm text-muted-foreground">
            Surveillance en temps reel des appels commerciaux
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card
          className={`border-border/60 ${activeListeningRooms.size > 0 ? 'bg-red-500/4' : ''}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Ecoutes actives
                </p>
                <p
                  className={`text-2xl font-bold mt-1 ${activeListeningRooms.size > 0 ? 'text-red-500' : ''}`}
                >
                  {activeListeningRooms.size}
                </p>
              </div>
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-lg ${activeListeningRooms.size > 0 ? 'bg-red-500/10' : 'bg-muted/60'}`}
              >
                <Mic
                  className={`w-4 h-4 ${activeListeningRooms.size > 0 ? 'text-red-500' : 'text-muted-foreground'}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-border/60 ${onlineCount > 0 ? 'bg-green-500/4' : ''}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  En ligne
                </p>
                <p
                  className={`text-2xl font-bold mt-1 ${onlineCount > 0 ? 'text-green-600' : ''}`}
                >
                  {onlineCount}
                </p>
              </div>
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-lg ${onlineCount > 0 ? 'bg-green-500/10' : 'bg-muted/60'}`}
              >
                <Activity
                  className={`w-4 h-4 ${onlineCount > 0 ? 'text-green-600' : 'text-muted-foreground'}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total
                </p>
                <p className="text-2xl font-bold mt-1">{filteredUsers.length}</p>
              </div>
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted/60">
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Statut
              </span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  {statusFilterOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Recherche
              </span>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un utilisateur..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="h-9 pl-8"
                />
              </div>
            </div>

            <label
              className={`flex items-center gap-2.5 cursor-pointer h-9 px-3 rounded-md border transition-colors ${
                showOnlyOnline
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-input hover:bg-accent/50'
              }`}
            >
              <input
                type="checkbox"
                checked={showOnlyOnline}
                onChange={e => setShowOnlyOnline(e.target.checked)}
                className="w-4 h-4 rounded border-input accent-green-500"
              />
              <span
                className={`text-sm font-medium whitespace-nowrap ${showOnlyOnline ? 'text-green-600' : ''}`}
              >
                En ligne uniquement
              </span>
            </label>

            <Badge variant="outline" className="h-9 px-3 shrink-0">
              {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {currentUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/60 mb-3">
            <Users className="w-7 h-7 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground font-medium">Aucun utilisateur trouve</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Modifiez vos filtres ou attendez que des utilisateurs se connectent
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {currentUsers.map(user => {
              const userKey = `${user.userType}-${user.id}`
              const isOnline = isUserOnline(user.id, user.userType)
              const isListening = activeListeningRooms.has(userKey)
              const listeningData = activeListeningRooms.get(userKey)

              return (
                <UserCard
                  key={`user-${user.userType}-${user.id}`}
                  user={user}
                  isOnline={isOnline}
                  isListening={isListening}
                  listeningData={listeningData}
                  audioTrack={audioTracks.get(userKey) || null}
                  isMuted={isMuted}
                  setIsMuted={setIsMuted}
                  onStart={handleStartListening}
                  onStop={handleStopListening}
                  userKey={userKey}
                />
              )
            })}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={filteredUsers.length}
            itemLabel="utilisateurs"
            onPrevious={goToPreviousPage}
            onNext={goToNextPage}
            hasPreviousPage={hasPreviousPage}
            hasNextPage={hasNextPage}
          />
        </div>
      )}
    </div>
  )
}
