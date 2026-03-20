import { useParams, useNavigate } from 'react-router-dom'
import {
  usePorte,
  useRecordingSegmentsByPorte,
  useStatusHistoriqueByPorte,
} from '@/hooks/metier/use-api'
import { useImmeuble } from '@/services'

export function usePorteDetailsLogic() {
  const { id: immeubleId, porteId } = useParams()
  const navigate = useNavigate()

  const { data: porte, loading: porteLoading, error: porteError } = usePorte(parseInt(porteId))
  const { data: immeuble, loading: immeubleLoading } = useImmeuble(parseInt(immeubleId))
  const { data: segments, loading: segmentsLoading } = useRecordingSegmentsByPorte(
    parseInt(porteId)
  )
  const { data: historique, loading: historiqueLoading } = useStatusHistoriqueByPorte(
    parseInt(porteId)
  )

  const goBack = () => navigate(-1)

  return {
    porte,
    immeuble,
    segments,
    historique,
    loading: porteLoading || immeubleLoading,
    segmentsLoading,
    historiqueLoading,
    error: porteError,
    goBack,
    immeubleId,
  }
}
