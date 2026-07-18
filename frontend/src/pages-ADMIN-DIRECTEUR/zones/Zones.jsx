import { lazy, Suspense } from 'react'
import { Repeat } from 'lucide-react'
import { AdvancedDataTable } from '@/components/tableau'
import { MapSkeleton } from '@/components/LoadingSkeletons'
import { ActionConfirmation } from '@/components/ActionConfirmation'
import { useZonesLogic } from './useZonesLogic'
import ZoneAssignModal from './ZoneAssignModal'

const ZoneCreatorModal = lazy(() => import('@/components/ZoneCreatorModal'))

export default function Zones() {
  const {
    description,
    enrichedZones,
    zonesColumns,
    permissions,
    mapboxLazyLoader,
    handleAddZone,
    handleEditZone,
    handleDeleteZone,
    showZoneModal,
    handleZoneValidate,
    handleCloseModal,
    zonesData,
    editingZone,
    currentRole,
    assignableUsers,
    isSubmittingZone,
    confirmAction,
    setConfirmAction,
    confirmDeleteZone,
    confirmEditZone,
    reassignModal,
    isReassigning,
    handleReassignZone,
    handleCloseReassignModal,
    handleReassignValidate,
  } = useZonesLogic()

  const rowActions = permissions.canEdit
    ? [
        {
          key: 'reassign',
          label: 'Réassigner',
          icon: Repeat,
          onClick: handleReassignZone,
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <AdvancedDataTable
        showStatusColumn={false}
        title="Zones en cours"
        description={description}
        data={enrichedZones}
        columns={zonesColumns}
        searchKey="nom"
        onAdd={permissions.canAdd ? handleAddZone : undefined}
        addButtonText="Nouvelle Zone"
        detailsPath="/zones"
        onEdit={permissions.canEdit ? handleEditZone : undefined}
        onDelete={permissions.canDelete ? handleDeleteZone : undefined}
        rowActions={rowActions}
        lazyLoaders={[mapboxLazyLoader]}
      />

      {showZoneModal && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[100] bg-background/40 backdrop-blur-sm">
              <MapSkeleton />
            </div>
          }
        >
          <ZoneCreatorModal
            onValidate={handleZoneValidate}
            onClose={handleCloseModal}
            existingZones={zonesData}
            zoneToEdit={editingZone}
            userRole={currentRole}
            assignableUsers={assignableUsers}
            isSubmitting={isSubmittingZone}
          />
        </Suspense>
      )}

      <ZoneAssignModal
        isOpen={reassignModal.isOpen}
        zone={reassignModal.zone}
        assignableUsers={assignableUsers}
        initialSelectedUserIds={reassignModal.initialSelectedUserIds}
        onValidate={handleReassignValidate}
        onClose={handleCloseReassignModal}
        isSubmitting={isReassigning}
      />

      <ActionConfirmation
        isOpen={confirmAction.isOpen}
        onClose={() => setConfirmAction({ isOpen: false, type: '', zone: null, isLoading: false })}
        onConfirm={confirmAction.type === 'delete' ? confirmDeleteZone : confirmEditZone}
        type={confirmAction.type}
        title={confirmAction.type === 'delete' ? 'Supprimer la zone' : 'Modifier la zone'}
        description={
          confirmAction.type === 'delete'
            ? 'Cette action supprimera définitivement la zone et toutes ses associations avec les commerciaux.'
            : 'Vous allez modifier les paramètres de cette zone.'
        }
        itemName={confirmAction.zone?.nom}
        confirmText={confirmAction.type === 'delete' ? 'Supprimer' : 'Modifier'}
        isLoading={confirmAction.isLoading}
      />
    </div>
  )
}
