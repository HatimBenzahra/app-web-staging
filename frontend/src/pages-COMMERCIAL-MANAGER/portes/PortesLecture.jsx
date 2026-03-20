import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Eye, Building } from 'lucide-react'

import { useRole } from '@/contexts/userole'
import { usePortesLogic } from './hooks/usePortesLogic'

import PortesListe from './components/PortesListe'

/**
 * Page de lecture seule des portes d'un immeuble
 * Interface simplifiée pour consultation sans modification
 */
export default function PortesLecture() {
  const { immeubleId } = useParams()
  const navigate = useNavigate()
  const { isManager } = useRole()

  // Custom hook pour récupérer les données (lecture seule)
  const { state } = usePortesLogic()

  const {
    portes,
    statsData,
    loading,
    loadingImmeuble,
    immeuble,
    immeubleId: hookImmeubleId,
  } = state

  // Navigation vers la gestion
  const handleGoToGestion = () => {
    navigate(`/portes/${immeubleId}`)
  }

  // Retour à la liste des immeubles
  const handleBackToImmeubles = () => {
    navigate('/historique')
  }

  return (
    <div className="space-y-4">
      {/* Header avec navigation */}
      <div className="top-0 z-100 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleBackToImmeubles}
              className="flex items-center gap-2 h-9 w-30 bg-blue-500 hover:bg-blue-600 text-white font-bold shadow-md"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>

            <div className="flex items-center gap-2 text-lg text-black bg-blue-500 rounded-full w-full px-6 py-2">
              <Building className="h-4 w-4" />
              <span className="font-medium">{immeuble?.adresse}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoToGestion}
                className="flex items-center gap-2 h-9"
              >
                <Eye className="h-4 w-4" />
                Gérer
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Contenu principal - vue liste en lecture seule */}
      <PortesListe
        portes={portes}
        statsData={statsData}
        loading={(loading && portes.length === 0) || loadingImmeuble}
        isFetchingMore={false}
        immeuble={immeuble}
        immeubleId={hookImmeubleId}
        onEdit={null} // Désactivé en lecture seule
        onQuickChange={null} // Désactivé en lecture seule
        onRepassageChange={null} // Désactivé en lecture seule
        onBack={handleBackToImmeubles}
        onAddEtage={null} // Désactivé en lecture seule
        onAddPorteToEtage={null} // Désactivé en lecture seule
        addingEtage={false}
        addingPorteToEtage={false}
        selectedFloor={null}
        onFloorSelect={null} // Désactivé en lecture seule
        readOnly={true} // Flag pour mode lecture seule
      />
    </div>
  )
}
